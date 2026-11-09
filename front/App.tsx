import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import Inscription from "./pages/Inscription";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import Connexion from "./pages/Connexion";
import StudentPage from "./pages/StudentPage";
import MonEspace from "./pages/MonEspace";
import RequireStudent from "./components/RequireStudent";
import SchoolPage from "./pages/SchoolPage";
import OffersPage from "./pages/OffersPage";
import CompaniesPage from "./pages/CompaniesPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import ApplicationDraftPage from "./pages/ApplicationDraftPage";
import RequireRecruiter from "./components/RequireRecruiter";
import CandidatesPage from "./pages/CandidatesPage";
import CandidateProfilePage from "./pages/CandidateProfilePage";

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
				<Route path="/recruiter/candidates" element={<RequireRecruiter>{() => <CandidatesPage />}</RequireRecruiter>} />
				<Route path="/recruiter/candidates/:id" element={<RequireRecruiter>{() => <CandidateProfilePage />}</RequireRecruiter>} />
				{/* Recruiter pages not built yet (RecruiterNavbar). The routes above, more specific, take precedence. */}
				<Route path="/recruiter/*" element={<ComingSoonPage />} />
				<Route path="/applications" element={<RequireStudent>{() => <ApplicationsPage />}</RequireStudent>} />
				<Route path="/applications/:id" element={<RequireStudent>{() => <ApplicationDetailPage />}</RequireStudent>} />
				<Route path="/applications/:id/edit" element={<RequireStudent>{() => <ApplicationDraftPage />}</RequireStudent>} />
				<Route path="/pricing" element={<ComingSoonPage />} />
				{/* TODO: remove the route /MonEspace when login and sub apis are ready */}
				<Route path="/MonEspace" element={<MonEspace />} />
				<Route path="/filters" element={<ComingSoonPage />} />
				<Route path="/messages" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
