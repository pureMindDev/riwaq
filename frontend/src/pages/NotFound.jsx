import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p><Link to="/">Go back home</Link></p>
    </>
  )
}
