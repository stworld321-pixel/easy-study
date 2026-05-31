import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Eye, Heart, Tag, ArrowLeft, Share2, Copy, Check,
  Twitter, Facebook, Linkedin, Clock, ArrowRight, BookOpen
} from 'lucide-react';
import { blogAPI } from '../services/api';
import type { BlogPost as BlogPostType, BlogListItem } from '../services/api';
import ReactMarkdown from 'react-markdown';

const hasHtmlMarkup = (content: string) => /<\/?[a-z][\s\S]*>/i.test(content);

const sanitizeRichHtml = (content: string) => {
  if (typeof window === 'undefined') return content;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name);
      }
      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return doc.body.innerHTML;
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<BlogPostType | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<BlogListItem[]>([]);
  const [recentBlogs, setRecentBlogs] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchBlog();
    }
  }, [slug]);

  const fetchBlog = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await blogAPI.getPublicBlogBySlug(slug!);
      setBlog(data);
      setLikes(data.likes);

      const [related, recent] = await Promise.all([
        data.category
          ? blogAPI.getPublicBlogs({ category: data.category, per_page: 4 })
          : Promise.resolve({ blogs: [], total: 0, page: 1, per_page: 4, total_pages: 0 }),
        blogAPI.getPublicBlogs({ per_page: 5 }),
      ]);

      setRelatedBlogs(related.blogs.filter(b => b.id !== data.id).slice(0, 3));
      setRecentBlogs(recent.blogs.filter(b => b.id !== data.id).slice(0, 4));
    } catch {
      setError('Blog post not found');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (liked || !blog) return;
    try {
      const result = await blogAPI.likeBlog(blog.slug);
      setLikes(result.likes);
      setLiked(true);
    } catch (error) {
      console.error('Failed to like blog:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(blog?.title || '');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(blog?.title || '');
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`, '_blank');
  };

  // Estimate reading time
  const getReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes;
  };

  const contentIsHtml = Boolean(blog?.content && hasHtmlMarkup(blog.content));
  const safeHtmlContent = useMemo(
    () => (blog?.content && contentIsHtml ? sanitizeRichHtml(blog.content) : ''),
    [blog?.content, contentIsHtml]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Blog Post Not Found</h1>
          <p className="text-gray-600 mb-8">The blog post you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Hero Section */}
      <section className="relative">
        {blog.featured_image ? (
          <div className="h-[400px] md:h-[500px] relative">
            <img
              src={blog.featured_image}
              alt={blog.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </div>
        ) : (
          <div className="h-[300px] bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700" />
        )}

        {/* Back Button */}
        <div className="absolute top-4 left-4 md:top-8 md:left-8">
          <button
            onClick={() => navigate('/blog')}
            className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-gray-700 hover:bg-white transition-colors shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </button>
        </div>

        {/* Title Section */}
        <div className={`${blog.featured_image ? 'absolute bottom-0 left-0 right-0 text-white' : 'bg-white text-gray-900'}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {blog.category && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    blog.featured_image ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
                  }`}>
                    {blog.category}
                  </span>
                )}
                {blog.is_featured && (
                  <span className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-medium">
                    Featured
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                {blog.title}
              </h1>
              {blog.excerpt && (
                <p className={`text-lg ${blog.featured_image ? 'text-white/80' : 'text-gray-600'}`}>
                  {blog.excerpt}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 items-start">
            {/* Main Content */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm p-6 md:p-10 lg:p-12"
            >
              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 pb-6 mb-8 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {blog.author_avatar ? (
                    <img src={blog.author_avatar} alt={blog.author_name || ''} className="w-12 h-12 rounded-full" />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold">
                      {(blog.author_name || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{blog.author_name || 'Admin'}</div>
                    <div className="text-sm text-gray-500">Author</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 ml-auto">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(blog.published_at || blog.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {getReadingTime(blog.content)} min read
                  </span>
                </div>
              </div>

              {/* Blog Content */}
              <div className="blog-rich-content max-w-none">
                {contentIsHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: safeHtmlContent }} />
                ) : (
                  <ReactMarkdown>{blog.content}</ReactMarkdown>
                )}
              </div>

              {/* Tags */}
              {blog.tags && blog.tags.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="w-5 h-5 text-gray-400" />
                    {blog.tags.map(tag => (
                      <Link
                        key={tag}
                        to={`/blog?tag=${tag}`}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleLike}
                    disabled={liked}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                      liked
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                    {likes}
                  </button>
                  <span className="flex items-center gap-2 text-gray-500">
                    <Eye className="w-5 h-5" />
                    {blog.views} views
                  </span>
                </div>

                {/* Share Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                    Share
                  </button>

                  {showShareMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 p-2 min-w-[160px] z-10"
                    >
                      <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                        {copied ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={shareOnTwitter}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                        Twitter
                      </button>
                      <button
                        onClick={shareOnFacebook}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Facebook className="w-5 h-5 text-[#4267B2]" />
                        Facebook
                      </button>
                      <button
                        onClick={shareOnLinkedIn}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                        LinkedIn
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.article>

            {/* Sidebar */}
            <aside className="space-y-6 lg:sticky lg:top-24">
              {/* Author Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <h3 className="font-bold text-gray-900 mb-4">About the Author</h3>
                <div className="flex items-center gap-3 mb-4">
                  {blog.author_avatar ? (
                    <img src={blog.author_avatar} alt={blog.author_name || ''} className="w-14 h-14 rounded-full" />
                  ) : (
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {(blog.author_name || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{blog.author_name || 'Admin'}</div>
                    <div className="text-sm text-gray-500">Content Writer</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Sharing insights and tips about education, tutoring, and learning strategies.
                </p>
              </motion.div>

              {/* Recent Posts */}
              {recentBlogs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl shadow-sm p-6"
                >
                  <h3 className="font-bold text-gray-900 mb-4">Recent Posts</h3>
                  <div className="space-y-4">
                    {recentBlogs.map(recent => (
                      <Link
                        key={recent.id}
                        to={`/blog/${recent.slug}`}
                        className="block group"
                      >
                        <div className="flex gap-3">
                          {recent.featured_image ? (
                            <img
                              src={recent.featured_image}
                              alt={recent.title}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-6 h-6 text-primary-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors text-sm">
                              {recent.title}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {new Date(recent.published_at || recent.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Related Posts */}
              {relatedBlogs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-white rounded-2xl shadow-sm p-6"
                >
                  <h3 className="font-bold text-gray-900 mb-4">Related Articles</h3>
                  <div className="space-y-4">
                    {relatedBlogs.map(related => (
                      <Link
                        key={related.id}
                        to={`/blog/${related.slug}`}
                        className="block group"
                      >
                        <div className="flex gap-3">
                          {related.featured_image ? (
                            <img
                              src={related.featured_image}
                              alt={related.title}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors text-sm">
                              {related.title}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {new Date(related.published_at || related.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Booking CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-600 p-6 text-white shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Need help with this topic?</h3>
                <p className="text-sm text-white/85 mb-5">
                  Book a one-on-one session with an expert tutor and get guidance tailored to your goals.
                </p>
                <Link
                  to="/find-tutors"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-medium text-primary-700 transition-colors hover:bg-white/90"
                >
                  Book a Session
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogPost;
