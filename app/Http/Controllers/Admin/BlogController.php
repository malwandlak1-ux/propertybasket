<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\BlogPost;
use App\Models\BlogTag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class BlogController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $filter = $request->string('filter', 'all')->toString();
        $q      = $request->string('q')->toString();

        $query = BlogPost::with(['tags:id,name,slug,color', 'author:id,name'])
            ->orderByRaw("CASE status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END")
            ->orderByDesc('published_at')
            ->orderByDesc('updated_at');

        if (in_array($filter, ['draft', 'published'], true)) {
            $query->where('status', $filter);
        }
        if ($q !== '') {
            $term = "%{$q}%";
            $query->where(fn ($q) => $q->where('title', 'like', $term)->orWhere('excerpt', 'like', $term));
        }

        $posts = $query->paginate(20)->withQueryString();

        $counts = [
            'all'       => BlogPost::count(),
            'published' => BlogPost::where('status', 'published')->count(),
            'draft'     => BlogPost::where('status', 'draft')->count(),
        ];

        return Inertia::render('Admin/Blog/Index', [
            'posts'  => $posts,
            'filter' => $filter,
            'q'      => $q,
            'counts' => $counts,
        ]);
    }

    public function create(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        return Inertia::render('Admin/Blog/Form', [
            'post'    => null,
            'allTags' => BlogTag::orderBy('name')->get(['id', 'name', 'slug', 'color']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        $data = $this->validateData($request);

        $post = BlogPost::create([
            'author_id'    => $request->user()->id,
            'title'        => $data['title'],
            'slug'         => $this->uniqueSlug($data['title']),
            'excerpt'      => $data['excerpt'] ?? null,
            'body'         => $data['body'],
            'cover_image'  => $this->handleCoverUpload($request, null),
            'status'       => $data['status'],
            'published_at' => $this->resolvePublishedAt($data['status'], $data['published_at'] ?? null, null),
        ]);

        $post->tags()->sync($this->syncTagIds($data['tags'] ?? []));

        return redirect()
            ->route('admin.blog.edit', $post)
            ->with('success', $post->status === 'published'
                ? "Published \"{$post->title}\"."
                : "Draft \"{$post->title}\" saved.");
    }

    public function edit(Request $request, BlogPost $post): Response
    {
        $this->ensureSuperAdmin($request);
        $post->load('tags:id,name,slug,color');

        return Inertia::render('Admin/Blog/Form', [
            'post'    => $post,
            'allTags' => BlogTag::orderBy('name')->get(['id', 'name', 'slug', 'color']),
        ]);
    }

    public function update(Request $request, BlogPost $post): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        $data = $this->validateData($request);

        $wasDraft = $post->status === 'draft';

        $post->update([
            'title'        => $data['title'],
            'slug'         => $post->slug,  // never re-slug on update (preserve URLs)
            'excerpt'      => $data['excerpt'] ?? null,
            'body'         => $data['body'],
            'cover_image'  => $this->handleCoverUpload($request, $post->cover_image),
            'status'       => $data['status'],
            'published_at' => $this->resolvePublishedAt($data['status'], $data['published_at'] ?? null, $post->published_at),
        ]);

        $post->tags()->sync($this->syncTagIds($data['tags'] ?? []));

        $msg = $wasDraft && $post->status === 'published'
            ? "Published \"{$post->title}\"."
            : "Saved \"{$post->title}\".";

        return back()->with('success', $msg);
    }

    public function destroy(Request $request, BlogPost $post): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($post->cover_image) {
            $rel = preg_replace('#^/?storage/#', '', parse_url($post->cover_image, PHP_URL_PATH) ?? '');
            if ($rel) Storage::disk('public')->delete($rel);
        }

        $title = $post->title;
        $post->delete();

        return redirect()
            ->route('admin.blog.index')
            ->with('success', "Deleted \"{$title}\".");
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private function validateData(Request $request): array
    {
        return $request->validate([
            'title'   => ['required', 'string', 'max:200'],
            'excerpt' => ['nullable', 'string', 'max:400'],
            'body'    => ['required', 'string', 'max:200000'],
            'status'  => ['required', 'in:draft,published'],
            'published_at' => ['nullable', 'date'],
            'cover'   => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
            'remove_cover' => ['nullable', 'boolean'],
            'tags'    => ['nullable', 'array'],
            'tags.*'  => ['string', 'max:80'],
        ]);
    }

    /**
     * Resolve the published_at timestamp. Drafts have none. A published post
     * uses the admin-supplied date/time (interpreted in the app timezone,
     * Africa/Johannesburg) — which may be in the FUTURE, in which case the
     * public BlogPost::published() scope keeps the post hidden until that
     * moment arrives. That gives native scheduled publishing with no cron:
     * the post simply becomes visible once now() passes published_at. Falls
     * back to the post's existing value, then to now().
     */
    private function resolvePublishedAt(string $status, ?string $input, ?Carbon $current): ?Carbon
    {
        if ($status !== 'published') {
            return null;
        }
        if (! empty($input)) {
            return Carbon::parse($input);
        }
        return $current ?? Carbon::now();
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'post';
        $slug = $base;
        $i = 2;
        while (BlogPost::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }
        return $slug;
    }

    private function handleCoverUpload(Request $request, ?string $current): ?string
    {
        if ($request->boolean('remove_cover')) {
            if ($current) {
                $rel = preg_replace('#^/?storage/#', '', parse_url($current, PHP_URL_PATH) ?? '');
                if ($rel) Storage::disk('public')->delete($rel);
            }
            return null;
        }

        if ($request->hasFile('cover')) {
            if ($current) {
                $rel = preg_replace('#^/?storage/#', '', parse_url($current, PHP_URL_PATH) ?? '');
                if ($rel) Storage::disk('public')->delete($rel);
            }
            $path = $request->file('cover')->store('blog/covers', 'public');
            return Storage::url($path);
        }

        return $current;
    }

    /**
     * Turn the form's tag list (strings — names typed by admin) into a set of
     * BlogTag ids, creating new tags on the fly.
     *
     * @param  array<int, string>  $names
     * @return array<int, int>
     */
    private function syncTagIds(array $names): array
    {
        $palette = ['#5B3DF5', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6'];
        $ids = [];

        foreach (array_unique(array_filter(array_map('trim', $names))) as $name) {
            $slug = Str::slug($name) ?: Str::slug('tag');
            $tag = BlogTag::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'color' => $palette[array_rand($palette)]],
            );
            $ids[] = $tag->id;
        }

        return $ids;
    }
}
