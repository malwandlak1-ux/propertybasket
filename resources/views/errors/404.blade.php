@extends('errors.layout', ['title' => 'Page not found', 'status' => '404'])

@section('heading', 'We can\'t find that page')
@section('body', 'The page you\'re looking for has moved, been deleted, or never existed. Double-check the URL or jump back to the home page.')

@section('actions')
    <a href="/" class="btn btn-primary">Go home</a>
    <a href="/properties" class="btn btn-secondary">Browse properties</a>
@endsection
