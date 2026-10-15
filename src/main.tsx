import { render } from 'preact';
import { App } from './App';
import { pruneNights } from './nights';
import './styles.css';

pruneNights();
render(<App />, document.getElementById('app')!);
