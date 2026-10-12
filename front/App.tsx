import React from "react"; // Do not remove !
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ReactDOM from "react-dom/client";

import Index from "./Index";

function App() {
	return (
		<BrowserRouter>
			<nav>
				<Link to="/">Index</Link>
			</nav>
			<Routes>
				<Route path="/" element={<Index />} />
			</Routes>
		</BrowserRouter>
	);
}

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);
