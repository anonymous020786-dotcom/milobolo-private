import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box, Container, Typography, Grid, Card, CardActionArea, CardContent,
  Chip, Stack, TextField, InputAdornment, Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import Layout from "@/components/Layout";
import { useState, useMemo } from "react";

interface Topic {
  id: string;
  emoji: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
}

const TOPICS: Topic[] = [
  // Entertainment
  { id: "gaming", emoji: "🎮", label: "Gaming", description: "Video games, esports, reviews, and gaming culture.", category: "Entertainment", tags: ["games", "esports", "streaming"] },
  { id: "anime", emoji: "🍜", label: "Anime & Manga", description: "Discuss your favourite anime series, manga, and studios.", category: "Entertainment", tags: ["anime", "manga", "otaku"] },
  { id: "movies", emoji: "🎬", label: "Movies & TV", description: "Films, series, recommendations, and hot takes.", category: "Entertainment", tags: ["movies", "shows", "netflix"] },
  { id: "music", emoji: "🎵", label: "Music", description: "All genres — share playlists, artists, and concerts.", category: "Entertainment", tags: ["music", "concerts", "playlists"] },
  { id: "kpop", emoji: "🌸", label: "K-Pop", description: "BTS, BLACKPINK, groups, comebacks, and fandom talk.", category: "Entertainment", tags: ["kpop", "bts", "blackpink"] },
  { id: "comedy", emoji: "😂", label: "Comedy & Memes", description: "Jokes, memes, funny stories — keep it light.", category: "Entertainment", tags: ["humor", "memes", "jokes"] },

  // Lifestyle
  { id: "travel", emoji: "✈️", label: "Travel", description: "Destinations, travel tips, hidden gems, and adventure.", category: "Lifestyle", tags: ["travel", "destinations", "backpacking"] },
  { id: "food", emoji: "🍕", label: "Food & Cooking", description: "Recipes, restaurants, cuisines, and food experiments.", category: "Lifestyle", tags: ["food", "cooking", "recipes"] },
  { id: "fitness", emoji: "💪", label: "Fitness & Health", description: "Workouts, nutrition, mental health, and wellness.", category: "Lifestyle", tags: ["fitness", "gym", "health"] },
  { id: "fashion", emoji: "👗", label: "Fashion & Style", description: "Outfits, trends, streetwear, and personal style.", category: "Lifestyle", tags: ["fashion", "style", "ootd"] },
  { id: "photography", emoji: "📸", label: "Photography", description: "Camera gear, techniques, editing, and photo sharing.", category: "Lifestyle", tags: ["photography", "camera", "editing"] },

  // Learning
  { id: "language", emoji: "🌐", label: "Language Exchange", description: "Practice a new language with native speakers worldwide.", category: "Learning", tags: ["language", "exchange", "learning"] },
  { id: "coding", emoji: "💻", label: "Coding & Tech", description: "Programming, web dev, AI, and software engineering.", category: "Learning", tags: ["coding", "programming", "tech"] },
  { id: "science", emoji: "🔬", label: "Science", description: "Physics, biology, space, climate, and breakthroughs.", category: "Learning", tags: ["science", "space", "biology"] },
  { id: "history", emoji: "🏛️", label: "History", description: "Ancient civilisations, wars, revolutions, and forgotten stories.", category: "Learning", tags: ["history", "civilisations", "archaeology"] },
  { id: "philosophy", emoji: "🤔", label: "Philosophy", description: "Ethics, metaphysics, big questions, and deep conversations.", category: "Learning", tags: ["philosophy", "ethics", "logic"] },

  // Social
  { id: "lgbtq", emoji: "🏳️‍🌈", label: "LGBTQ+", description: "Safe space for LGBTQ+ people to chat and connect.", category: "Social", tags: ["lgbtq", "pride", "inclusion"] },
  { id: "mentalhealth", emoji: "💙", label: "Mental Health", description: "Supportive, non-judgemental conversations about wellbeing.", category: "Social", tags: ["mental health", "support", "wellbeing"] },
  { id: "startup", emoji: "🚀", label: "Startup & Business", description: "Entrepreneurship, side projects, ideas, and hustle.", category: "Social", tags: ["startup", "business", "entrepreneurship"] },
  { id: "art", emoji: "🎨", label: "Art & Design", description: "Illustration, graphic design, digital art, and creativity.", category: "Social", tags: ["art", "design", "illustration"] },
  { id: "books", emoji: "📚", label: "Books & Reading", description: "Recommendations, reviews, authors, and literary discussion.", category: "Social", tags: ["books", "reading", "literature"] },
  { id: "yoga", emoji: "🧘", label: "Yoga & Mindfulness", description: "Meditation, breathwork, mindfulness, and inner peace.", category: "Social", tags: ["yoga", "meditation", "mindfulness"] },

  // India
  { id: "bollywood", emoji: "🎭", label: "Bollywood", description: "Indian cinema, songs, actors, and film gossip.", category: "India", tags: ["bollywood", "hindi", "cinema"] },
  { id: "cricket", emoji: "🏏", label: "Cricket", description: "IPL, Test matches, player stats, and match reactions.", category: "India", tags: ["cricket", "ipl", "bcci"] },
  { id: "desi", emoji: "🇮🇳", label: "Desi Chat", description: "Casual Hindi, Hinglish, or regional language conversations.", category: "India", tags: ["india", "hindi", "desi"] },
];

const CATEGORIES = ["All", "Entertainment", "Lifestyle", "Learning", "Social", "India"];

export default function TopicsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return TOPICS.filter((t) => {
      const matchCat = category === "All" || t.category === category;
      const matchSearch = !q || t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q));
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const grouped = useMemo(() => {
    if (category !== "All" || search) return { [category !== "All" ? category : "Results"]: filtered };
    return CATEGORIES.slice(1).reduce<Record<string, Topic[]>>((acc, cat) => {
      const items = filtered.filter((t) => t.category === cat);
      if (items.length) acc[cat] = items;
      return acc;
    }, {});
  }, [filtered, category, search]);

  const startChat = (topic: Topic, mode: "video" | "text") => {
    const interests = encodeURIComponent(topic.label);
    if (mode === "video") router.push(`/chat?mode=video&interests=${interests}`);
    else router.push(`/chat?mode=text&interests=${interests}`);
  };

  return (
    <Layout title="Topic Rooms — MiloBolo">
      <Head>
        <title>Topic Rooms — MiloBolo</title>
        <meta name="description" content="Choose a topic and instantly connect with strangers who share your interests. Gaming, anime, travel, language exchange, and 20+ more topic rooms." />
      </Head>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        {/* Header */}
        <Box textAlign="center" mb={5}>
          <Typography variant="h3" fontWeight={900} mb={1} sx={{
            background: "linear-gradient(135deg,#fff 0%,#6C63FF 55%,#FF6584 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Topic Rooms
          </Typography>
          <Typography color="text.secondary" maxWidth={520} mx="auto" lineHeight={1.8}>
            Pick a topic and chat with strangers who share your interests — no need to type your interests manually.
          </Typography>
        </Box>

        {/* Search + category filter */}
        <Stack spacing={2} mb={4}>
          <TextField
            fullWidth
            placeholder="Search topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" } }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                size="small"
                onClick={() => setCategory(cat)}
                color={category === cat ? "primary" : "default"}
                variant={category === cat ? "filled" : "outlined"}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Stack>
        </Stack>

        {/* Topic grid by group */}
        {Object.entries(grouped).map(([groupName, topics]) => (
          <Box key={groupName} mb={5}>
            {Object.keys(grouped).length > 1 && (
              <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1.5} display="block" mb={2}>
                {groupName}
              </Typography>
            )}
            <Grid container spacing={2}>
              {topics.map((topic) => (
                <Grid item xs={12} sm={6} md={4} key={topic.id}>
                  <Card sx={{
                    height: "100%", borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.06)",
                    bgcolor: "rgba(255,255,255,0.02)",
                    transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      borderColor: "rgba(108,99,255,0.35)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 32px rgba(108,99,255,0.15)",
                    },
                  }}>
                    <CardContent sx={{ pb: 1.5 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1.5} mb={1}>
                        <Typography fontSize={32} lineHeight={1}>{topic.emoji}</Typography>
                        <Box flex={1}>
                          <Typography fontWeight={700} fontSize={15}>{topic.label}</Typography>
                          <Typography variant="caption" color="text.disabled">{topic.category}</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" lineHeight={1.6} mb={2} sx={{ minHeight: 40 }}>
                        {topic.description}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          fullWidth size="small" variant="contained"
                          startIcon={<VideoCallIcon sx={{ fontSize: 16 }} />}
                          onClick={() => startChat(topic, "video")}
                          sx={{ borderRadius: 1.5, fontSize: 12, py: 0.75, background: "linear-gradient(135deg,#6C63FF,#8B5CF6)" }}
                        >
                          Video
                        </Button>
                        <Button
                          fullWidth size="small" variant="outlined"
                          startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
                          onClick={() => startChat(topic, "text")}
                          sx={{ borderRadius: 1.5, fontSize: 12, py: 0.75, borderColor: "rgba(108,99,255,0.4)" }}
                        >
                          Text
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        {filtered.length === 0 && (
          <Box textAlign="center" py={10}>
            <Typography fontSize={48} mb={2}>🤷</Typography>
            <Typography color="text.secondary">No topics match "{search}". Try a different keyword.</Typography>
            <Button variant="text" sx={{ mt: 2 }} onClick={() => { setSearch(""); setCategory("All"); }}>
              Clear filters
            </Button>
          </Box>
        )}
      </Container>
    </Layout>
  );
}
