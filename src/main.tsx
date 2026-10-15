import { render } from 'preact';
import { App } from './App';
import { pruneNights } from './nights';
import { pruneWatch } from './watch';
import './styles.css';

pruneNights();
pruneWatch();
render(<App />, document.getElementById('app')!);
