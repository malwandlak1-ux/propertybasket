<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SystemController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        // ── System health (stubs — real implementation would check uptime/queues) ─
        $health = [
            [
                'name'    => 'API',
                'status'  => 'healthy',
                'uptime'  => '99.98%',
                'latency' => '42ms',
                'detail'  => 'All endpoints responding normally',
            ],
            [
                'name'    => 'Database',
                'status'  => 'healthy',
                'uptime'  => '99.99%',
                'latency' => '12ms',
                'detail'  => 'MySQL 8 · ' . $this->dbSize() . ' MB',
            ],
            [
                'name'    => 'Paystack webhooks',
                'status'  => 'healthy',
                'uptime'  => '99.95%',
                'latency' => '180ms',
                'detail'  => 'Last webhook 2 min ago',
            ],
            [
                'name'    => 'Email queue',
                'status'  => 'warning',
                'uptime'  => '99.90%',
                'latency' => '—',
                'detail'  => '142 messages pending dispatch',
            ],
            [
                'name'    => 'Storage (S3)',
                'status'  => 'healthy',
                'uptime'  => '100.00%',
                'latency' => '85ms',
                'detail'  => '8.4 GB used',
            ],
            [
                'name'    => 'Background jobs',
                'status'  => 'healthy',
                'uptime'  => '99.97%',
                'latency' => '—',
                'detail'  => '12 workers · ' . $this->failedJobsCount() . ' failed jobs',
            ],
        ];

        // Recent incidents (stubbed timeline)
        $incidents = [
            [
                'id'         => 1,
                'severity'   => 'resolved',
                'title'      => 'Paystack webhook timeout',
                'summary'    => 'Webhook retries took up to 30s for ~12 minutes. No charges lost.',
                'started_at' => now()->subDays(3)->format('d M Y H:i'),
                'duration'   => '12 minutes',
            ],
            [
                'id'         => 2,
                'severity'   => 'resolved',
                'title'      => 'Email queue backlog',
                'summary'    => 'Worker pool was undersized during the May notification burst. Scaled to 12 workers.',
                'started_at' => now()->subDays(8)->format('d M Y H:i'),
                'duration'   => '47 minutes',
            ],
        ];

        return Inertia::render('Admin/System', [
            'counts'    => $this->sidebarCounts(),
            'health'    => $health,
            'incidents' => $incidents,
        ]);
    }

    private function dbSize(): string
    {
        try {
            $rows = DB::select("SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb FROM information_schema.tables WHERE table_schema = DATABASE()");
            return (string) ($rows[0]->mb ?? '—');
        } catch (\Throwable) {
            return '—';
        }
    }

    private function failedJobsCount(): int
    {
        try {
            return DB::table('failed_jobs')->count();
        } catch (\Throwable) {
            return 0;
        }
    }
}
