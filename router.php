<?php

$uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($uri !== '' && file_exists(__DIR__ . '/' . $uri)) {
    return false;
}

$_GET['page'] = $uri === '' ? 'home' : $uri;
require __DIR__ . '/index.php';