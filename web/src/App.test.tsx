import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the MediStock application title', () => {
    render(<App />)

    expect(
      screen.getAllByText('MediStock')[0],
    ).toBeInTheDocument()
  })

  it('renders exactly one Transfers link in the sidebar navigation without duplicate groups', () => {
    render(<App />)

    const transferLinks = screen.getAllByRole('link', { name: /transfers/i })
    expect(transferLinks).toHaveLength(1)
    expect(transferLinks[0]).toHaveAttribute('href', '/transfers')

    const redistributionHeadings = screen.getAllByText('Redistribution')
    expect(redistributionHeadings).toHaveLength(1)
  })
})
