<?php

define('VERSION', "V2.0");
define('ROOT_DIR', '');
define('PRETTY', '');
define('PAGES_TODO', [
    'recipes/macncheese',
    'recipes/pizza',
    'recipes/tiramisu',
    'recipes/carrotcake',
    'recipes/waspnests',
    'recipes/oreoicecream',
]);

function image_url(string $filepath): string {
    $path = ROOT_DIR . '/media/images/' . $filepath;
    return $path;
}
function function_url(string $filepath): string {
    $path = ROOT_DIR . '/app/' . $filepath;
    return $path;
}
function page_url(string $filepath): string {
    $path = ROOT_DIR . '/' . PRETTY . $filepath;
    return $path;
}

function locator(): string {
    global $hierarchy;

    $separator = " 〉 ";
    $page = $_GET['page'] ?? '';
    $page = explode('/', $page);
    if ($page[0] != 'home') {
        array_unshift($page, 'home');
    }
    $end = array_pop($page);

    $path = "";
    foreach ($page as $url) {
        $path = $path . $separator . '<a href="' . page_url($url) . '">' . $url . '</a>';
    }

    $path = $path . $separator . "<span class='endpoint'>" . $end . "</span>";

    return $path;
}
function page_content() {
    global $hierarchy;

    $page = $_GET['page'] ?? '';
    $path = 'content/' . $page . '.phtml';

    if (! file_exists($path)) {
        if (in_array($page, PAGES_TODO)) {
            $path = 'content/501.phtml';
        } else {
            $path = 'content/404.phtml';
        }
    }
    include $path;
}