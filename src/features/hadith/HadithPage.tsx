import { useRoute } from 'preact-iso';
import { BookView } from './BookView';
import { Library } from './Library';
import './hadith.css';

export default function HadithPage() {
  const { params } = useRoute();
  return params.book ? <BookView slug={params.book} /> : <Library />;
}
