import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  AppBar, Toolbar, Typography, Button, Avatar, IconButton,
  Menu, MenuItem, Box, Chip, Divider, useMediaQuery, useTheme,
  Drawer, List, ListItem, ListItemButton, ListItemText, Badge, Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PeopleIcon from "@mui/icons-material/People";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

  const navLinks = [
    { label: "Video Chat", href: "/chat?mode=video" },
    { label: "Text Chat", href: "/chat?mode=text" },
    { label: "Spy Mode", href: "/spy" },
    { label: "Speed Dating", href: "/speed-dating" },
    { label: "College", href: "/college" },
    { label: "Topics", href: "/topics" },
    { label: "Blog", href: "/blog" },
    { label: "About", href: "/about" },
  ];

  // Load pending friend requests count for logged-in users
  useEffect(() => {
    if (!user) { setPendingRequests(0); return; }
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { count } = await supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "pending");
      setPendingRequests(count || 0);
    };

    load();

    // Realtime subscription for new requests
    channel = supabase
      .channel(`navbar-requests-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "connections",
        filter: `receiver_id=eq.${user.id}`,
      }, () => load())
      .subscribe();

    return () => { channel?.unsubscribe(); };
  }, [user]);

  return (
    <AppBar position="sticky" elevation={0}
      sx={{ bgcolor: "rgba(10,10,15,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(108,99,255,0.15)" }}>
      <Toolbar sx={{ maxWidth: 1200, mx: "auto", width: "100%", px: { xs: 2, md: 4 } }}>
        <Link href="/" style={{ textDecoration: "none", flexGrow: 1 }}>
          <Typography variant="h6" sx={{
            fontWeight: 800, background: "linear-gradient(135deg, #6C63FF, #FF6584)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            MiloBolo
          </Typography>
        </Link>

        {isMobile ? (
          <>
            {/* Mobile: notification bell + hamburger */}
            {user && pendingRequests > 0 && (
              <Tooltip title={`${pendingRequests} friend request${pendingRequests > 1 ? "s" : ""}`}>
                <IconButton onClick={() => router.push("/friends")} color="inherit" sx={{ mr: 0.5 }}>
                  <Badge badgeContent={pendingRequests} color="error" max={9}>
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={() => setDrawerOpen(true)} color="inherit">
              <MenuIcon />
            </IconButton>
            <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
              PaperProps={{ sx: { bgcolor: "background.paper", width: 240 } }}>
              <List sx={{ mt: 2 }}>
                {navLinks.map((l) => (
                  <ListItem key={l.href} disablePadding>
                    <ListItemButton onClick={() => { router.push(l.href); setDrawerOpen(false); }}>
                      <ListItemText primary={l.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
                {user && (
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => { router.push("/friends"); setDrawerOpen(false); }}>
                      <ListItemText primary="Friends" />
                      {pendingRequests > 0 && (
                        <Chip label={pendingRequests} size="small" color="error" sx={{ height: 18, fontSize: 10, ml: 1 }} />
                      )}
                    </ListItemButton>
                  </ListItem>
                )}
                <Divider sx={{ my: 1 }} />
                {user ? (
                  <>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => { router.push("/profile"); setDrawerOpen(false); }}>
                        <ListItemText primary="Profile" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => { router.push("/settings"); setDrawerOpen(false); }}>
                        <ListItemText primary="Settings" />
                      </ListItemButton>
                    </ListItem>
                    {profile?.role && ["admin","superadmin"].includes(profile.role) && (
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => { router.push("/admin"); setDrawerOpen(false); }}>
                          <ListItemText primary="Admin Panel" />
                        </ListItemButton>
                      </ListItem>
                    )}
                    <ListItem disablePadding>
                      <ListItemButton onClick={signOut}>
                        <ListItemText primary="Sign Out" />
                      </ListItemButton>
                    </ListItem>
                  </>
                ) : (
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => { router.push("/auth/login"); setDrawerOpen(false); }}>
                      <ListItemText primary="Sign In" />
                    </ListItemButton>
                  </ListItem>
                )}
              </List>
            </Drawer>
          </>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {navLinks.map((l) => (
              <Button key={l.href} component={Link} href={l.href}
                sx={{ color: router.pathname === l.href ? "primary.main" : "text.secondary", fontSize: 13 }}>
                {l.label}
              </Button>
            ))}
            {user ? (
              <>
                {/* Friends button with badge */}
                <Tooltip title={pendingRequests ? `${pendingRequests} pending request${pendingRequests > 1 ? "s" : ""}` : "Friends"}>
                  <IconButton
                    onClick={() => router.push("/friends")}
                    sx={{ color: router.pathname === "/friends" ? "primary.main" : "text.secondary", mx: 0.5 }}
                  >
                    <Badge badgeContent={pendingRequests || undefined} color="error" max={9}>
                      <PeopleIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                </Tooltip>

                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
                  <Avatar src={profile?.avatar_url || undefined} sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
                    {profile?.display_name?.[0]?.toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
                  PaperProps={{ sx: { bgcolor: "background.paper", minWidth: 180 } }}>
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      {profile?.display_name || user.email}
                    </Typography>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => { router.push("/profile"); setAnchorEl(null); }}>Profile</MenuItem>
                  <MenuItem onClick={() => { router.push("/settings"); setAnchorEl(null); }}>Settings</MenuItem>
                  <MenuItem onClick={() => { router.push("/history"); setAnchorEl(null); }}>Chat History</MenuItem>
                  {profile?.role && ["admin","superadmin"].includes(profile.role) && (
                    <MenuItem onClick={() => { router.push("/admin"); setAnchorEl(null); }}>
                      Admin Panel <Chip label="Admin" size="small" color="primary" sx={{ ml: 1 }} />
                    </MenuItem>
                  )}
                  <Divider />
                  <MenuItem onClick={signOut} sx={{ color: "error.main" }}>Sign Out</MenuItem>
                </Menu>
              </>
            ) : (
              <Button variant="contained" color="primary" component={Link} href="/auth/login" sx={{ ml: 1 }}>
                Sign In
              </Button>
            )}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
