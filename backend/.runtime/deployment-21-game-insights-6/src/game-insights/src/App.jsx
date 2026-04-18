import { RouterProvider } from "react-router-dom";
import { router } from "./AppRoutes";
import { UserProvider } from "./components/context/UserContent";

export default function App() {
  return (
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  );
}
