<?php

define('VERSION', "V2.0");
define('ROOT_DIR', '');
define('PAGES_TODO', [
    'recipes/macncheese',
    'recipes/pizza',
    'recipes/tiramisu',
    'recipes/carrotcake',
    'recipes/waspnests',
    'recipes/oreoicecream',
]);

function current_page(): string {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = trim($path, '/');
    $path = str_replace(['..', "\0"], '', $path); // prevent directory traversal
    return $path === '' ? 'home' : $path;
}

function image_url(string $filepath): string {
    return ROOT_DIR . '/media/images/' . $filepath;
}
function function_url(string $filepath): string {
    return ROOT_DIR . '/app/' . $filepath;
}
function page_url(string $filepath): string {
    return ROOT_DIR . '/' . $filepath;
}

function locator(): string {
    $separator = " 〉 ";
    $page = explode('/', current_page());
    if ($page[0] != 'home') {
        array_unshift($page, 'home');
    }
    $end = array_pop($page);

    $path = "";
    $accum = [];
    foreach ($page as $url) {
        $accum[] = $url === 'home' ? 'home' : $url;
        $href = $url === 'home' ? 'home' : implode('/', $accum);
        $path .= $separator . '<a href="' . page_url($href) . '">' . $url . '</a>';
    }

    $path .= $separator . "<span class='endpoint'>" . $end . "</span>";

    return $path;
}

function page_content() {
    $page = current_page();
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