<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Daily check at 08:00 SAST: email agents whose FFC expires within 30 days.
Schedule::command('ffc:remind')->dailyAt('08:00');
