<?php
header("Access-Control-Allow-Origin: *");
   /**
     * @OA\Get(
     *     path="/v1/getuser/", tags={"dev"},
     * *          @OA\Parameter(
     *                in="query", 
     *                name="user",  example="sebastian.boga@outlook.com",
     *               @OA\Schema(type="string")
     * ),
     *     @OA\Response(response="200", description="Success")
     * );
     */

$qs = $_SERVER['QUERY_STRING'];
$qs = urldecode($qs);


if (isset($_GET['user']))
  {
$user = $_GET['user'];
$user = urlencode($user);

$url =  'http://23.97.216.44/solr/auth/select?'.'omitHeader=true&q.op=OR&q=id%3A'.$user;
$json = file_get_contents($url);
$json = json_decode($json);
unset($json->response->docs[0]->_version_);
echo json_encode($json->response->docs[0]);
  }
?>