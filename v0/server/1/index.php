<?php

// Replace these variables with your SOLR server details
$solrUrl = 'http://peviitor.go.ro/solr'; // Updated SOLR server URL with "/solr"
$coreName = 'jobs'; // Name of your SOLR core

// Function to check if SOLR server is up and running
function isSolrServerUp($solrUrl, $coreName) {
    $pingUrl = $solrUrl . '/' . $coreName . '/admin/ping?wt=json';

    // Initialize cURL session
    $ch = curl_init($pingUrl);

    // Set cURL options
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    // Execute cURL request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Close cURL session
    curl_close($ch);

    // Check the HTTP response code
    if ($httpCode === 200) {
        $data = json_decode($response, true);

        // Check if SOLR is up and running based on the response
        if (isset($data['status']) && $data['status'] === 'OK') {
            return true;
        }
    }

    return false;
}

// Check if SOLR server is up
if (isSolrServerUp($solrUrl, $coreName)) {
    echo "SOLR server is up and running!";
} else {
    echo "SOLR server is not responding.";
}

?>
