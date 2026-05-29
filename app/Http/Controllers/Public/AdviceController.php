<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogTag;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdviceController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'tag' => ['nullable', 'string', 'max:100'],
            'q'   => ['nullable', 'string', 'max:120'],
        ]);

        $query = BlogPost::published()
            ->with(['tags:id,name,slug,color', 'author:id,name'])
            ->orderByDesc('published_at')
            ->orderByDesc('id');

        if (! empty($filters['tag'])) {
            $query->whereHas('tags', fn ($q) => $q->where('slug', $filters['tag']));
        }
        if (! empty($filters['q'])) {
            $term = '%' . $filters['q'] . '%';
            $query->where(fn ($q) => $q
                ->where('title', 'like', $term)
                ->orWhere('excerpt', 'like', $term));
        }

        $posts = $query->paginate(9)->withQueryString();

        $tags = BlogTag::query()
            ->whereHas('posts', fn ($q) => $q->where('status', 'published'))
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'color']);

        $featured = BlogPost::published()
            ->with(['tags:id,name,slug,color'])
            ->orderByDesc('published_at')
            ->first();

        return Inertia::render('Public/Advice/Index', [
            'posts'    => $posts,
            'tags'     => $tags,
            'filters'  => $filters,
            'featured' => $featured,
        ]);
    }

    public function show(string $slug): Response
    {
        $post = BlogPost::published()
            ->where('slug', $slug)
            ->with(['tags:id,name,slug,color', 'author:id,name'])
            ->first();

        if (! $post) {
            throw new NotFoundHttpException('Article not found.');
        }

        $post->increment('view_count');

        $related = BlogPost::published()
            ->where('id', '!=', $post->id)
            ->whereHas('tags', fn ($q) => $q->whereIn('blog_tags.id', $post->tags->pluck('id')))
            ->with(['tags:id,name,slug,color'])
            ->orderByDesc('published_at')
            ->limit(3)
            ->get();

        return Inertia::render('Public/Advice/Show', [
            'post'    => $post,
            'related' => $related,
        ]);
    }
}
