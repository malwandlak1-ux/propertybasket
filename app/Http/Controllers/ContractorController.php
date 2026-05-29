<?php

namespace App\Http\Controllers;

use App\Models\Contractor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContractorController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'speciality' => ['nullable', 'string', 'max:60'],
            'area' => ['nullable', 'string', 'max:60'],
        ]);

        $query = Contractor::query()
            ->where('status', 'active')
            ->with('user:id,name,email,phone');

        if (! empty($filters['speciality'])) {
            $query->whereJsonContains('specialities', $filters['speciality']);
        }
        if (! empty($filters['area'])) {
            $query->whereJsonContains('service_areas', $filters['area']);
        }

        $contractors = $query
            ->orderByDesc('average_rating')
            ->orderByDesc('total_jobs')
            ->get();

        return Inertia::render('Contractors/Index', [
            'contractors' => $contractors,
            'filters' => $filters,
        ]);
    }
}
