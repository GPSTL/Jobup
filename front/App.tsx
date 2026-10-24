import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import Inscription from "./pages/Inscription";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import Connexion from "./pages/Connexion";
import StudentPage from "./pages/StudentPage";
import OffersPage from "./pages/OffersPage";
import CompaniesPage from "./pages/CompaniesPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/students" element={<StudentPage />} />
				<Route path="/signup" element={<Inscription />} />
				<Route path="/login" element={<Connexion />} />
				<Route path="/offers" element={<OffersPage />} />
				<Route path="/companies" element={<CompaniesPage />} />
				<Route path="/pricing" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
