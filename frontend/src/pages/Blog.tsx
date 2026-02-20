import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, Calendar, Eye, Heart, Tag, ChevronLeft, ChevronRight,
  ArrowRight, Filter, X
} from 'lucide-react';
import { blogAPI } from '../services/api';
import type { BlogListItem, BlogPaginated, BlogCategory } from '../services/api';

const Blog: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 9,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // Categories and Tags
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogCategory[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Fetch categories and tags on mount
    const fetchMeta = async () => {
      try {
        const [categoriesData, tagsData] = await Promise.all([
          blogAPI.getCategories(),
          blogAPI.getTags()
        ]);
        setCategories(categoriesData);
        setTags(tagsData);
      } catch (error) {
        console.error('Failed to fetch blog metadata:', error);
      }
    };
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [pagination.page, search, selectedCategory, selectedTag, showFeaturedOnly]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const data: BlogPaginated = await blogAPI.getPublicBlogs({
        page: pagination.page,
        per_page: pagination.perPage,
        search: search || undefined,
        category: selectedCategory || undefined,
        tag: selectedTag || undefined,
        featured: showFeaturedOnly ? true : undefined
      });
      setBlogs(data.blogs);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.total_pages
      }));
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedTag('');
    setShowFeaturedOnly(false);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = search || selectedCategory || selectedTag || showFeaturedOnly;

  // Featured blogs for hero section
  const featuredBlogs = blogs.filter(b => b.is_featured).slice(0, 3);
  const regularBlogs = blogs.filter(b => !featuredBlogs.includes(b));

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-white"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Blog</h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Insights, tips, and stories about education, tutoring, and learning
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="border-b border-gray-200 bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                    {[search, selectedCategory, selectedTag, showFeaturedOnly].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Quick category filters */}
              {categories.slice(0, 4).map(cat => (
                <button
                  key={cat.name}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.name ? '' : cat.name);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className={`px-4 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                    selectedCategory === cat.name
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pb-4 border-t border-gray-100 pt-4"
            >
              <div className="grid md:grid-cols-3 gap-4">
                {/* Categories */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => {
                          setSelectedCategory(selectedCategory === cat.name ? '' : cat.name);
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedCategory === cat.name
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cat.name} ({cat.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Popular Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 8).map(tag => (
                      <button
                        key={tag.name}
                        onClick={() => {
                          setSelectedTag(selectedTag === tag.name ? '' : tag.name);
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition-colors ${
                          selectedTag === tag.name
                            ? 'bg-secondary-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Featured Only */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Options</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFeaturedOnly}
                      onChange={(e) => {
                        setShowFeaturedOnly(e.target.checked);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Show featured posts only</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Blog Content */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : blogs.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No articles found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Featured Posts (only on first page with no filters) */}
              {pagination.page === 1 && !hasActiveFilters && featuredBlogs.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Articles</h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {featuredBlogs.map((blog, index) => (
                      <motion.div
                        key={blog.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link
                          to={`/blog/${blog.slug}`}
                          className="group block bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                        >
                          <div className="aspect-video bg-gray-100 relative overflow-hidden">
                            {blog.featured_image ? (
                              <img
                                src={blog.featured_image}
                                alt={blog.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary-400 to-secondary-500" />
                            )}
                            <div className="absolute top-3 left-3 px-3 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full">
                              Featured
                            </div>
                          </div>
                          <div className="p-5">
                            {blog.category && (
                              <span className="text-sm text-primary-600 font-medium">{blog.category}</span>
                            )}
                            <h3 className="font-bold text-gray-900 mt-1 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                              {blog.title}
                            </h3>
                            {blog.excerpt && (
                              <p className="text-gray-600 text-sm line-clamp-2 mb-3">{blog.excerpt}</p>
                            )}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(blog.published_at || blog.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  {blog.views}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-4 h-4" />
                                  {blog.likes}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Posts */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {hasActiveFilters ? 'Search Results' : 'Latest Articles'}
                  </h2>
                  <span className="text-gray-500">{pagination.total} articles</span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(hasActiveFilters ? blogs : regularBlogs).map((blog, index) => (
                    <motion.div
                      key={blog.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={`/blog/${blog.slug}`}
                        className="group block bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow h-full"
                      >
                        <div className="aspect-video bg-gray-100 relative overflow-hidden">
                          {blog.featured_image ? (
                            <img
                              src={blog.featured_image}
                              alt={blog.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-2">
                            {blog.category && (
                              <span className="text-xs text-primary-600 font-medium px-2 py-1 bg-primary-50 rounded-full">
                                {blog.category}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(blog.published_at || blog.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                            {blog.title}
                          </h3>
                          {blog.excerpt && (
                            <p className="text-gray-600 text-sm line-clamp-2 mb-3">{blog.excerpt}</p>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span className="flex items-center gap-2">
                              {blog.author_avatar ? (
                                <img src={blog.author_avatar} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                              )}
                              {blog.author_name || 'Admin'}
                            </span>
                            <span className="flex items-center gap-1 text-primary-600 font-medium group-hover:gap-2 transition-all">
                              Read more <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first, last, current, and adjacent pages
                        return page === 1 ||
                               page === pagination.totalPages ||
                               Math.abs(page - pagination.page) <= 1;
                      })
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setPagination(prev => ({ ...prev, page }))}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                              pagination.page === page
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      ))}

                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
