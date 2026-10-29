import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import Inscription from "./pages/Inscription";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import Connexion from "./pages/Connexion";
import StudentPage from "./pages/StudentPage";
import MonEspace from "./pages/MonEspace";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/students" element={<StudentPage />} />
				<Route path="/signup" element={<Inscription />} />
				<Route path="/login" element={<Connexion />} />
				<Route path="/offers" element={<ComingSoonPage />} />
				<Route path="/companies" element={<ComingSoonPage />} />
				<Route path="/pricing" element={<ComingSoonPage />} />
				{/* TODO: remove the route /MonEspace when login and sub apis are ready */}
				<Route path="/MonEspace" element={<MonEspace />} />
				<Route path="/filters" element={<ComingSoonPage />} />
				<Route path="/messages" element={<ComingSoonPage />} />
				<Route path="/applications" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
