import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  AppBar, Toolbar, Typography, Button, Avatar, IconButton,
  Menu, MenuItem, Box, Chip, Divider, useMediaQuery, useTheme,
  Drawer, List, ListItem, ListItemButton, ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navLinks = [
    { label: "Video Chat", href: "/chat?mode=video" },
    { label: "Text Chat", href: "/chat?mode=text" },
    { label: "Spy Mode", href: "/spy" },
    { label: "History", href: "/history" },
  ];

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
                <Divider sx={{ my: 1 }} />
                {user ? (
                  <>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => { router.push("/profile"); setDrawerOpen(false); }}>
                        <ListItemText primary="Profile" />
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
                sx={{ color: router.pathname === l.href ? "primary.main" : "text.secondary" }}>
                {l.label}
              </Button>
            ))}
            {user ? (
              <>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
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
