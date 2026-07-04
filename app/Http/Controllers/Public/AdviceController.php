<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogTag;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
        ])->withViewData(['seo' => $this->buildSeo($post)]);
    }

    /**
     * Build server-rendered SEO metadata (canonical, OpenGraph, Twitter card,
     * JSON-LD) for an article. Rendered in the root Blade template because this
     * app has no Inertia SSR — social scrapers and search crawlers don't execute
     * our client-side JS, so <Head> tags alone would be invisible to them.
     *
     * @return array<string, mixed>
     */
    private function buildSeo(BlogPost $post): array
    {
        $url         = url("/advice/{$post->slug}");
        $description = $post->excerpt
            ?: Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags($post->body)) ?? ''), 160);
        $image = $post->cover_image
            ? (Str::startsWith($post->cover_image, ['http://', 'https://'])
                ? $post->cover_image
                : url($post->cover_image))
            : url('/images/logo.png');
        $published = optional($post->published_at)->toIso8601String();
        $modified  = optional($post->updated_at)->toIso8601String();
        $author    = $post->author?->name ?: 'Property Basket';
        $faqs      = $this->extractFaqs($post->body);

        $jsonld = [
            [
                '@context'         => 'https://schema.org',
                '@type'            => 'BlogPosting',
                'headline'         => Str::limit($post->title, 110, ''),
                'description'      => $description,
                'image'            => [$image],
                'datePublished'    => $published,
                'dateModified'     => $modified ?: $published,
                'author'           => ['@type' => 'Person', 'name' => $author],
                'publisher'        => [
                    '@type' => 'Organization',
                    'name'  => 'Property Basket',
                    'logo'  => ['@type' => 'ImageObject', 'url' => url('/images/logo.png')],
                ],
                'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
            ],
            [
                '@context'        => 'https://schema.org',
                '@type'           => 'BreadcrumbList',
                'itemListElement' => [
                    ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home',   'item' => url('/')],
                    ['@type' => 'ListItem', 'position' => 2, 'name' => 'Advice', 'item' => url('/advice')],
                    ['@type' => 'ListItem', 'position' => 3, 'name' => $post->title, 'item' => $url],
                ],
            ],
        ];

        if (! empty($faqs)) {
            $jsonld[] = [
                '@context'   => 'https://schema.org',
                '@type'      => 'FAQPage',
                'mainEntity' => array_map(fn ($f) => [
                    '@type'          => 'Question',
                    'name'           => $f['q'],
                    'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']],
                ], $faqs),
            ];
        }

        return [
            'title'       => $post->title,
            'description' => $description,
            'url'         => $url,
            'image'       => $image,
            'published'   => $published,
            'jsonld'      => $jsonld,
        ];
    }

    /**
     * Extract FAQ question/answer pairs from an article body so we can emit
     * FAQPage structured data. Convention: an <h2> containing "Frequently asked
     * questions", followed by alternating <h3> (question) / <p> (answer) pairs
     * until the next <h2>. Returns [] when the post has no FAQ section.
     *
     * @return array<int, array{q: string, a: string}>
     */
    private function extractFaqs(?string $bodyHtml): array
    {
        if (! $bodyHtml || stripos($bodyHtml, 'frequently asked questions') === false) {
            return [];
        }

        $prev = libxml_use_internal_errors(true);
        $dom  = new \DOMDocument();
        $dom->loadHTML(
            '<?xml encoding="UTF-8"><div id="__faqroot">' . $bodyHtml . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        $xpath = new \DOMXPath($dom);
        $faqH2 = null;
        foreach ($xpath->query('//h2') as $h2) {
            if (stripos($h2->textContent, 'frequently asked questions') !== false) {
                $faqH2 = $h2;
                break;
            }
        }
        if (! $faqH2) {
            return [];
        }

        $faqs = [];
        $question = null;
        for ($node = $faqH2->nextSibling; $node; $node = $node->nextSibling) {
            if (! $node instanceof \DOMElement) {
                continue;
            }
            $tag = strtolower($node->tagName);
            if ($tag === 'h2') {
                break; // reached the next section
            }
            if ($tag === 'h3') {
                $question = trim($node->textContent);
            } elseif ($tag === 'p' && $question !== null && $question !== '') {
                $answer = trim($node->textContent);
                if ($answer !== '') {
                    $faqs[] = ['q' => $question, 'a' => $answer];
                }
                $question = null;
            }
        }

        return $faqs;
    }
}
