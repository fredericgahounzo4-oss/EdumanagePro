import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Students from "./pages/Students.jsx";
import StudentDetail from "./pages/StudentDetail.jsx";
import Results from "./pages/Results.jsx";
import Users from "./pages/Users.jsx";
import Teachers from "./pages/Teachers.jsx";
import Timetable from "./pages/Timetable.jsx";
import Exams from "./pages/Exams.jsx";
import Matieres from "./pages/Matieres.jsx";
import FeuilleNotes from "./pages/FeuilleNotes.jsx";
import Settings from "./pages/Settings.jsx";
import Ecoles from "./pages/Ecoles.jsx";
import EspaceEleve from "./pages/EspaceEleve.jsx";
import Ecolage from "./pages/Ecolage.jsx";
import Parents from "./pages/Parents.jsx";
import Messagerie from "./pages/Messagerie.jsx";
import EspaceParent from "./pages/EspaceParent.jsx";
import MonEmploiDuTemps from "./pages/MonEmploiDuTemps.jsx";
import Login from "./pages/Login.jsx";
import Notifications from "./pages/Notifications.jsx";
import Presences from "./pages/Presences.jsx";
import Classes from "./pages/Classes.jsx";
import Statistiques from "./pages/Statistiques.jsx";
import Conseil from "./pages/Conseil.jsx";
import Shell from "./components/Shell.jsx";
import NotFound from "./components/NotFound.jsx";
import CompteBloque from "./pages/CompteBloque.jsx";
import { useAuth } from "./AuthContext";

function SuperAdminApp() {
  return (
    <Shell>
      <Routes><Route path="*" element={<Ecoles />} /></Routes>
    </Shell>
  );
}

function EcoleApp() {
  const { user } = useAuth();
  const admin = user.role === "Administrateur";
  const enseignant = user.role === "Enseignant";

  // Le caissier n'a accès qu'à la caisse, à la messagerie et à ses notifications
  if (user.role === "Caissier") {
    return (
      <Shell>
        <Routes>
          <Route path="/messagerie" element={<Messagerie />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Ecolage />} />
        </Routes>
      </Shell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/eleves" element={<Students />} />
        <Route path="/eleves/:id" element={<StudentDetail />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/presences" element={<Presences />} />
        <Route path="/statistiques" element={<Statistiques />} />
        <Route path="/conseil" element={<Conseil />} />
        <Route path="/notifications" element={<Notifications />} />
        {enseignant && <Route path="/notes-rapides" element={<FeuilleNotes />} />}
        {enseignant && <Route path="/mon-emploi-du-temps" element={<MonEmploiDuTemps />} />}
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/ecolage" element={admin ? <Ecolage /> : <Navigate to="/" />} />
        <Route path="/parents" element={admin ? <Parents /> : <Navigate to="/" />} />
        <Route path="/resultats" element={<Results />} />
        <Route path="/enseignants" element={<Teachers />} />
        <Route path="/emploi-du-temps" element={<Timetable />} />
        <Route path="/examens" element={<Exams />} />
        <Route path="/matieres" element={<Matieres />} />
        <Route path="/utilisateurs" element={admin ? <Users /> : <Navigate to="/" />} />
        <Route path="/parametres" element={admin ? <Settings /> : <Navigate to="/" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}

function EleveApp() {
  return (
    <Shell>
      <Routes>
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<EspaceEleve />} />
      </Routes>
    </Shell>
  );
}

function ParentApp() {
  return (
    <Shell>
      <Routes>
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<EspaceParent />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const { user, blocage } = useAuth();

  if (blocage) return <CompteBloque />;
  if (!user) return <Login />;
  if (user.role === "SuperAdmin") return <SuperAdminApp />;
  if (user.role === "Eleve") return <EleveApp />;
  if (user.role === "Parent") return <ParentApp />;
  return <EcoleApp />;
}
