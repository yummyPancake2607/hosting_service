import { createBrowserRouter } from "react-router-dom";

// Importing your pages based on your actual VS Code file names
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import GameDetailsPage from "./pages/GameDetailsPage";
import Profile from "./pages/Profile";
import Library from "./pages/Library";
import Browse from "./pages/Browse"; // Assuming you saved Browse here!
import CommunityChat from "./pages/CommunityChat";

// Note: If you don't have a RootLayout yet, you can temporarily
// remove it or create a simple wrapper component later.
import AppLayout from "./layouts/AppLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "game/:gameId",
        Component: GameDetailsPage,
      },
      {
        path: "profile",
        Component: Profile,
      },
      {
        path: "library",
        Component: Library,
      },
      {
        path: "browse",
        Component: Browse,
      },
      {
        path: "community-chat",
        Component: CommunityChat,
      },
    ],
  },
]);
