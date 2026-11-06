import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import Inscription from "./pages/Inscription";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import Connexion from "./pages/Connexion";
import StudentPage from "./pages/StudentPage";
import RequireStudent from "./components/RequireStudent";
import SchoolPage from "./pages/SchoolPage";
import OffersPage from "./pages/OffersPage";
import CompaniesPage from "./pages/CompaniesPage";

import EntrepriseCandita from "./pages/CompanieCandita";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/students" element={<StudentPage />} />
				<Route path="/schools" element={<SchoolPage />} />
				<Route path="/signup" element={<Inscription />} />
				<Route path="/login" element={<Connexion />} />
				<Route path="/student" element={<RequireStudent>{() => <ComingSoonPage />}</RequireStudent>} />
				<Route path="/offers" element={<OffersPage />} />
				<Route path="/companies" element={<CompaniesPage />} />
				<Route path="/entreprise/candidats" element={<EntrepriseCandita />} />
				<Route path="/coming-soon" element={<ComingSoonPage />} />
				<Route path="/pricing" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
