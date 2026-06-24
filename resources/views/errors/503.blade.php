@extends('errors.layout', ['title' => 'Be right back', 'status' => '503'])

@section('heading', 'We\'re briefly down for maintenance')
@section('body', 'We\'re making a quick update to the platform. Please check back in a few minutes — thanks for your patience.')

@section('actions')
    <a href="/" class="btn btn-primary">Refresh</a>
@endsection
