@extends('errors.layout', ['title' => 'Session expired', 'status' => '419'])

@section('heading', 'Your session timed out')
@section('body', 'For security, we sign you out after a period of inactivity. Refresh the page and sign in again to continue where you left off.')

@section('actions')
    <a href="{{ url()->previous() }}" class="btn btn-primary">Try again</a>
    <a href="/login" class="btn btn-secondary">Sign in</a>
@endsection
