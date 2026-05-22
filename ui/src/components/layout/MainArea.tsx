import SplitPane from './SplitPane';

export default function MainArea() {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <SplitPane />
    </div>
  );
}
