<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class CalculatorController extends Controller
{
    /**
     * Render the public bond + affordability calculator page.
     *
     * The math runs client-side so the user sees results update live as
     * they type. The controller's only job is to seed the default prime
     * lending rate and term length.
     */
    public function __invoke(): Response
    {
        return Inertia::render('Public/Calculator', [
            'defaults' => [
                // SA prime rate as of latest SARB MPC + 0.5% retail markup.
                // Update this when the SARB rate changes (or wire to a setting).
                'interest_rate' => 10.25,
                'loan_term'     => 20,
                // Banks generally use 30% of gross income as the maximum
                // bond installment ratio.
                'affordability_ratio' => 0.30,
            ],
        ]);
    }
}
