import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import {
  Box, Card, CardActionArea, CardContent, Chip, Container,
  Divider, Grid, InputAdornment, MenuItem, Pagination,
  Select, Stack, TextField, Typography, useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Link from "next/link";
import { BLOG_POSTS, BLOG_CATEGORIES, searchBlogPosts, BlogPost } from "@/data/blogPosts";

const POSTS_PER_PAGE = 9;

const CATEGORY_COLORS: Record<string, string> = {
  "Safety Tips": "error",
  "How-To Guides": "primary",
  "Privacy": "info",
  "Technology": "secondary",
  "Community": "success",
  "Mental Health": "warning",
  "Features": "default",
  "News & Updates": "primary",
};

function PostCard({ post }: { post: BlogPost }) {
  const theme = useTheme();
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 12px 32px ${theme.palette.primary.main}22`,
        },
      }}
    >
      <CardActionArea component={Link} href={`/blog/${post.slug}`} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <CardContent sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} mb={1.5} flexWrap="wrap" gap={0.5}>
            <Chip
              label={post.category}
              size="small"
              color={(CATEGORY_COLORS[post.category] as any) || "default"}
            />
            {post.featured && <Chip label="Featured" size="small" variant="outlined" color="warning" />}
          </Stack>
          <Typography variant="h6" fontWeight={700} gutterBottom lineHeight={1.4}>
            {post.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7} sx={{ mb: 2 }}>
            {post.excerpt}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" mt="auto">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled">
                {post.readTime} min read
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.disabled">
              {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function BlogIndex() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let posts = BLOG_POSTS;
    if (query.trim().length >= 2) posts = searchBlogPosts(query.trim());
    if (category !== "All") posts = posts.filter((p) => p.category === category);
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [query, category]);

  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const paged = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  const handleCategory = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <Layout
      title="Blog — Random Chat Tips, Safety, Privacy & More"
      description="MiloBolo Blog: expert guides on random chat safety, privacy, technology, mental health, and getting the most from video chat with strangers."
    >
      <SeoHead
        title="Blog — Random Chat Tips, Safety, Privacy & More"
        description="MiloBolo Blog: expert guides on random chat safety, privacy, technology, mental health, and getting the most from video chat with strangers."
        path="/blog"
      />
      {/* Hero */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}18, ${theme.palette.secondary.main}08)`,
          py: { xs: 7, md: 10 },
          textAlign: "center",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="md">
          <Chip label="MiloBolo Blog" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h3" fontWeight={900} gutterBottom>
            Insights for Smarter, Safer Chatting
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            {BLOG_POSTS.length}+ articles on safety, privacy, technology, mental health, and getting the most from random chat.
          </Typography>

          {/* Search */}
          <TextField
            placeholder="Search articles…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
            }}
            sx={{
              maxWidth: 500,
              width: "100%",
              bgcolor: "background.paper",
              borderRadius: 3,
              "& .MuiOutlinedInput-root": { borderRadius: 3 },
            }}
          />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        {/* Category chips */}
        <Stack direction="row" spacing={1} mb={4} flexWrap="wrap" gap={1}>
          {["All", ...BLOG_CATEGORIES].map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => handleCategory(cat)}
              color={category === cat ? "primary" : "default"}
              variant={category === cat ? "filled" : "outlined"}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Stack>

        {/* Results count */}
        <Typography variant="body2" color="text.secondary" mb={3}>
          {filtered.length} article{filtered.length !== 1 ? "s" : ""}
          {category !== "All" ? ` in "${category}"` : ""}
          {query ? ` matching "${query}"` : ""}
        </Typography>

        {/* Posts grid */}
        {paged.length > 0 ? (
          <Grid container spacing={3}>
            {paged.map((post) => (
              <Grid item xs={12} sm={6} md={4} key={post.slug}>
                <PostCard post={post} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" py={8}>
            <Typography variant="h6" color="text.secondary">
              No articles found.
            </Typography>
            <Typography variant="body2" color="text.disabled" mt={1}>
              Try a different search term or category.
            </Typography>
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Stack alignItems="center" mt={5}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              color="primary"
              size="large"
            />
          </Stack>
        )}
      </Container>
    </Layout>
  );
}
