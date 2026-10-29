import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DemoLoginGate } from './components/DemoLoginGate';
import './index.css';

createRoot(document.getElementById('root')!).render(<DemoLoginGate><App /></DemoLoginGate>);
