<?php
header("Access-Control-Allow-Origin: *");
    /**
     * @OA\Get(
     *     path="/v1/jobs/", tags={"machine learning"},
     *           @OA\Parameter(
     *                in="query", 
     *                 name="start",  
     *  @OA\Schema(
     *                   type="string"), 
     * example="100"
     * ),
     * 
     *     @OA\Response(response="200", description="Success")
     * )
     */


$qs = "q=*%3A*&rows=100&omitHeader=true";
//$qs = urldecode($qs);
if (isset($_GET["start"])) {$start=$_GET["start"];$qs.="&start=".$start;}
$url =  'http://solr.peviitor.ro/solr/shaqodoon/select?'.$qs;

 
 
$json = file_get_contents($url);


echo $json;



?>