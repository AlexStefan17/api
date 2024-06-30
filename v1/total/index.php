<?php
header("Access-Control-Allow-Origin: *");
   /**
     * @OA\Get(
     *     path="/v1/total/", tags={"UI"},
     *     @OA\Response(response="200", description="Success")
     * )
     */

$server = 'zimbor.go.ro:8985';
$core = "jobs";
     
$qs = '?';
$qs = $qs . 'facet.field=company_str';
$qs = $qs . '&';
$qs = $qs . 'facet.limit=10000';
$qs = $qs . '&';
$qs = $qs . 'facet=true';
$qs = $qs . '&';
$qs = $qs . 'fl=company';
$qs = $qs . '&';
$qs = $qs . 'indent=true';
$qs = $qs . '&';
$qs = $qs . 'q.op=OR';
$qs = $qs . '&';
$qs = $qs . 'q=*%3A*';
$qs = $qs . '&';
$qs = $qs . 'rows=0';
$qs = $qs . '&';
$qs = $qs . 'start=0';
$qs = $qs . '&';
$qs = $qs . 'useParams=';
     
$url = 'http://' . $server . '/solr/' . $core . '/select'. $qs;

$string = file_get_contents($url);
$json = json_decode($string, true);

$companies = $json['facet_counts']['facet_fields']['company_str'];



$obj = new stdClass();
$obj->total = new stdClass();
$obj->total -> jobs = ''.$json['response']['numFound'];
$obj->total -> companies = ''.count($companies)/2;

echo json_encode($obj);


?>