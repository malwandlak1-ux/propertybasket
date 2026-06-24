@extends('errors.layout', ['title' => 'Forbidden', 'status' => '403'])

@section('heading', 'You don\'t have access to that')
@section('body', 'Your account doesn\'t have permission to view this page. If you think that\'s a mistake, ask the platform admin or try signing in with a different account.')

@section('actions')
    <a href="/" class="btn btn-primary">Go home</a>
    <a href="/login" class="btn btn-secondary">Sign in</a>
@endsection
