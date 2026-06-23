import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Layout from "@/components/Layout";
import {
  Box, Button, Card, CardActionArea, CardContent, Chip, Container,
  Divider, Grid, LinearProgress, Stack, Tooltip, Typography, useTheme,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShareIcon from "@mui/icons-material/Share";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BLOG_POSTS, type BlogPost, getRelatedPosts } from "@/data/blogPosts";

interface Props {
  post: BlogPost;
  related: BlogPost[];
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: BLOG_POSTS.map((p) => ({ params: { slug: p.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = ({ params }) => {
  const post = BLOG_POSTS.find((p) => p.slug === params?.slug);
  if (!post) return { notFound: true };
  return { props: { post, related: getRelatedPosts(post.slug) } };
};

function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) return;
      setProgress(Math.min(100, (el.scrollTop / total) * 100));
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return progress;
}

export default function BlogPost({ post, related }: Props) {
  const theme = useTheme();
  const progress = useReadingProgress();
  const [copied, setCopied] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      await navigator.share({ title: post.title, text: post.excerpt, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const BASE = "https://chat.videodownloaders.cloud";
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "MiloBolo" },
    publisher: {
      "@type": "Organization",
      name: "MiloBolo",
      url: BASE,
    },
    url: `${BASE}/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  };

  return (
    <Layout
      title={`${post.title} | MiloBolo Blog`}
      description={post.excerpt}
    >
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>

      {/* Reading progress bar */}
      <Box sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1400 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 3, borderRadius: 0 }} />
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
        {/* Back + Share */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box
            component={Link}
            href="/blog"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              color: "text.secondary",
              textDecoration: "none",
              "&:hover": { color: "primary.main" },
            }}
          >
            <ArrowBackIcon fontSize="small" />
            <Typography variant="body2">Back to Blog</Typography>
          </Box>
          <Tooltip title={copied ? "Link copied!" : "Share this article"}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShareIcon fontSize="small" />}
              onClick={share}
              sx={{ borderRadius: 2 }}
            >
              {copied ? "Copied!" : "Share"}
            </Button>
          </Tooltip>
        </Stack>

        {/* Meta */}
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
          <Chip label={post.category} color="primary" size="small" />
          {post.tags.slice(0, 4).map((t) => (
            <Chip key={t} label={t} size="small" variant="outlined" />
          ))}
        </Stack>

        <Typography variant="h3" fontWeight={900} gutterBottom sx={{ fontSize: { xs: "1.8rem", md: "2.5rem" } }}>
          {post.title}
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center" mb={4}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <AccessTimeIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">
              {post.readTime} min read
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.disabled">
            {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </Typography>
        </Stack>

        <Typography variant="subtitle1" color="text.secondary" mb={4} fontStyle="italic" lineHeight={1.8}>
          {post.excerpt}
        </Typography>

        <Divider sx={{ mb: 4 }} />

        {/* Content */}
        <Box
          dangerouslySetInnerHTML={{ __html: post.content }}
          sx={{
            "& h2": {
              fontSize: "1.4rem",
              fontWeight: 700,
              mt: 4,
              mb: 1.5,
              color: "text.primary",
            },
            "& h3": {
              fontSize: "1.1rem",
              fontWeight: 700,
              mt: 3,
              mb: 1,
              color: "text.primary",
            },
            "& p": {
              mb: 2,
              lineHeight: 1.85,
              color: theme.palette.text.secondary,
            },
            "& ul, & ol": {
              pl: 3,
              mb: 2,
              "& li": {
                mb: 0.75,
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
              },
            },
            "& strong": { color: "text.primary" },
            "& kbd": {
              bgcolor: "background.default",
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              px: 0.8,
              py: 0.2,
              fontFamily: "monospace",
              fontSize: "0.85em",
            },
          }}
        />

        <Divider sx={{ mt: 6, mb: 4 }} />

        {/* Related Posts */}
        {related.length > 0 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Related Articles
            </Typography>
            <Grid container spacing={2} mt={1}>
              {related.map((r) => (
                <Grid item xs={12} sm={4} key={r.slug}>
                  <Card sx={{ borderRadius: 3, height: "100%" }}>
                    <CardActionArea component={Link} href={`/blog/${r.slug}`} sx={{ height: "100%" }}>
                      <CardContent>
                        <Chip label={r.category} size="small" color="primary" sx={{ mb: 1 }} />
                        <Typography variant="body2" fontWeight={600} lineHeight={1.4}>
                          {r.title}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
                          <AccessTimeIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                          <Typography variant="caption" color="text.disabled">
                            {r.readTime} min
                          </Typography>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Container>

      {/* Scroll to top */}
      {showTop && (
        <Box
          sx={{ position: "fixed", bottom: 100, right: 24, zIndex: 1300 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Tooltip title="Back to top">
            <Box
              sx={{
                width: 40, height: 40, borderRadius: "50%",
                bgcolor: "primary.main", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", boxShadow: 4,
                "&:hover": { bgcolor: "primary.dark" },
              }}
            >
              <ArrowUpwardIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
          </Tooltip>
        </Box>
      )}
    </Layout>
  );
}
