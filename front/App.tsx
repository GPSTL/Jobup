import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
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
import RecruiterPage from "./pages/RecruiterPage";
import OffersPage from "./pages/OffersPage";
import CompaniesPage from "./pages/CompaniesPage";
import PricingPage from "./pages/PricingPage";
import SessionProvider, { useSession } from "./components/SessionProvider";

function VisitorPage({ children }: { children: ReactNode }) {
	const { user, loading } = useSession();
	if (loading) return <p role="status" className="p-8 text-center">Chargement…</p>;
	return user ? <Navigate to="/student" replace /> : children;
}

function OffersRoute() {
	const { user, loading } = useSession();
	if (loading) return <p role="status" className="p-8 text-center">Chargement…</p>;
	return user ? <Navigate to="/student/offers" replace /> : <OffersPage />;
}

function App() {
	return (
		<BrowserRouter>
			<SessionProvider>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/students" element={<StudentPage />} />
				<Route path="/schools" element={<SchoolPage />} />
				<Route path="/recruiters" element={<RecruiterPage />} />
				<Route path="/signup" element={<VisitorPage><Inscription /></VisitorPage>} />
				<Route path="/login" element={<VisitorPage><Connexion /></VisitorPage>} />
				<Route path="/forgot-password" element={<ComingSoonPage title="Réinitialisation du mot de passe" />} />
				<Route path="/student" element={<RequireStudent>{() => <MonEspace />}</RequireStudent>} />
				<Route path="/offers" element={<OffersRoute />} />
				<Route path="/student/offers" element={<RequireStudent>{() => <ComingSoonPage title="Offres" />}</RequireStudent>} />
				<Route path="/student/companies/:company" element={<RequireStudent>{() => <ComingSoonPage title="Fiche entreprise" />}</RequireStudent>} />
				<Route path="/student/favorites" element={<RequireStudent>{() => <ComingSoonPage title="Mes favoris" />}</RequireStudent>} />
				<Route path="/companies" element={<CompaniesPage />} />
				<Route path="/pricing" element={<PricingPage />} />
				<Route path="/MonEspace" element={<Navigate to="/student" replace />} />
				<Route path="/filters" element={<RequireStudent>{() => <ComingSoonPage title="Filtrer les offres" />}</RequireStudent>} />
				<Route path="/messages" element={<RequireStudent>{() => <ComingSoonPage title="Messages" />}</RequireStudent>} />
				<Route path="/applications" element={<RequireStudent>{() => <ComingSoonPage title="Candidatures" />}</RequireStudent>} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
			</SessionProvider>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
