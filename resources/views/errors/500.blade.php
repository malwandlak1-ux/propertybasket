@extends('errors.layout', ['title' => 'Server error', 'status' => '500'])

@section('heading', 'Something went wrong on our end')
@section('body', 'We hit an unexpected error. Our team has been notified — please try again in a few moments.')

@section('actions')
    <a href="{{ url()->previous() }}" class="btn btn-primary">Try again</a>
    <a href="/" class="btn btn-secondary">Go home</a>
@endsection
