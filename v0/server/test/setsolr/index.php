<?php
// Data to be written to the file
$data = "https://solr.peviitor.ro/solr/";

// File path
$filePath = "../server.txt";

// Write data to the file
if (file_put_contents($filePath, $data) !== false) {
    echo "Data has been written to the file successfully.";
} else {
    echo "Unable to write data to the file.";
}
?>
