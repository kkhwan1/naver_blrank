import Header from '../Header';

export default function HeaderExample() {
  return (
    <Header onAddKeyword={() => console.log('Add keyword clicked')} />
  );
}
