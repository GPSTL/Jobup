import { BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";

import HomePage from "./pages/HomePage";
import Inscription from "./pages/Inscription";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/signup" element={<Inscription />} />
				<Route path="/login" element={<ComingSoonPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
