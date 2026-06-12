export function formatPageRange(pageStart, pageEnd) {
  if (!pageStart && !pageEnd) {
    return 'Pages unavailable'
  }
  if (pageStart && pageEnd && pageStart !== pageEnd) {
    return `Pages ${pageStart}-${pageEnd}`
  }
  return `Page ${pageStart || pageEnd}`
}

export function buildMetadataChips(nodeOrSource) {
  const metadata = nodeOrSource?.metadata || {}
  const chips = []
  const layoutStrategy = metadata.layoutStrategy || metadata.layout_strategy

  if (metadata.clauseNumber || metadata.clause_number) {
    chips.push(`Clause ${metadata.clauseNumber || metadata.clause_number}`)
  }

  if (metadata.clauseTitle || metadata.clause_title) {
    chips.push(metadata.clauseTitle || metadata.clause_title)
  }

  if (layoutStrategy === 'ADVERSARIAL') {
    if (metadata.partyEnclave || metadata.party_enclave) {
      chips.push(metadata.partyEnclave || metadata.party_enclave)
    }
    if (metadata.issueKey || metadata.issue_key) {
      chips.push(`Issue ${metadata.issueKey || metadata.issue_key}`)
    }
    if (metadata.argumentType || metadata.argument_type) {
      chips.push(metadata.argumentType || metadata.argument_type)
    }
  }

  if (layoutStrategy === 'HIERARCHICAL') {
    const hierarchy = metadata.sectionHierarchy || metadata.section_hierarchy || []
    for (const item of hierarchy) {
      if (typeof item === 'string') {
        chips.push(item)
      } else if (item?.title) {
        chips.push(item.title)
      } else if (item?.key) {
        chips.push(item.key)
      }
    }
    if (metadata.structuralDepth || metadata.structural_depth) {
      chips.push(`Structural Depth ${metadata.structuralDepth || metadata.structural_depth}`)
    }
  }

  if (!chips.length && layoutStrategy) {
    chips.push(layoutStrategy)
  }

  return chips
}
