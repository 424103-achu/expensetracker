import { Route, Routes } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes.jsx";

function App() {
  return (
    <Routes>
      <Route path="/*" element={<AppRoutes />} />
    </Routes>
  );
}

export default App;
