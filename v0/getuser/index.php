<?php
header("Access-Control-Allow-Origin: *");

$qs = $_SERVER['QUERY_STRING'];
$qs = urldecode($qs);

if (isset($_GET['user']))
  {
$user = $_GET['user'];
$user = urlencode($user);

$server = '172.18.0.10:8983';
$core = 'auth';
$url = 'http://' . $server . '/solr/' . $core . '/select?'.'omitHeader=true&q.op=OR&q=id%3A' . $user;
$json = file_get_contents($url);
$json = json_decode($json);
unset($json->response->docs[0]->_version_);
echo json_encode($json->response->docs[0]);
  }
?>
