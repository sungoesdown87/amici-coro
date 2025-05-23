"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VenueSelector } from "@/components/venue-selector"
import {
  Music,
  Plus,
  Edit,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoveUp,
  MoveDown,
  Camera,
  LayoutDashboard,
} from "lucide-react"
import type { Event, MusicItem } from "@/types/event"
import type { Venue } from "@/types/venue"
import Link from "next/link"

// Update imports at the top to include the date utils
import { formatDateForInput, parseInputDate, extractTimeForInput, combineDateAndTime } from "@/lib/date-utils"

// Music types for dropdown
const MUSIC_TYPES = ["Responses", "Psalm", "Magnificat", "Nunc Dimittis", "Anthem"]

interface EditEventFormProps {
  event: Event
}

export default function EditEventForm({ event }: EditEventFormProps) {
  // Remove the local formatDateForInput function and use the imported one

  const router = useRouter()
  const [title, setTitle] = useState(event.title)
  const [subtitle, setSubtitle] = useState(event.subtitle || "")
  // Update the state initialization to use the imported function
  const [date, setDate] = useState(formatDateForInput(event.date, event.venue?.timezone || "Europe/London"))
  const [endDate, setEndDate] = useState(formatDateForInput(event.endDate, event.venue?.timezone || "Europe/London"))
  const [venueId, setVenueId] = useState(event.venueId)
  const [slug, setSlug] = useState(event.slug)
  const [description, setDescription] = useState(event.description)
  // Update the scheduleItems state initialization to extract time from date
  const [scheduleItems, setScheduleItems] = useState<{ date: string; time: string; description: string }[]>(
    event.schedule?.map((item) => ({
      date: formatDateForInput(item.date, event.venue?.timezone || "Europe/London"),
      time: extractTimeForInput(item.date, event.venue?.timezone || "Europe/London"),
      description: item.description,
    })) || [],
  )

  // Convert musicList object to array format for the form
  const [musicListItems, setMusicListItems] = useState<{ category: string; items: MusicItem[] }[]>(
    Object.entries(event.musicList || {}).map(([category, items]) => ({
      category,
      items: items || [],
    })),
  )

  const [venues, setVenues] = useState<Venue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [musicTypeOpen, setMusicTypeOpen] = useState<{ [key: string]: boolean }>({})

  // State for expanded/collapsed sections
  const [expandedCategories, setExpandedCategories] = useState<{ [key: number]: boolean }>({})
  const [expandedServices, setExpandedServices] = useState<{ [key: number]: boolean }>({})
  const [editingItem, setEditingItem] = useState<{ categoryIndex: number; itemIndex: number } | null>(null)
  const [focusedServiceIndex, setFocusedServiceIndex] = useState<number | null>(null)

  // Fetch venues on mount
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const response = await fetch("/api/venues")
        if (!response.ok) {
          throw new Error("Failed to fetch venues")
        }
        const venuesData = await response.json()
        setVenues(venuesData)
      } catch (err) {
        console.error("Error loading venues:", err)
        setFormError("Failed to load venues. Please try again later.")
      }
    }

    fetchVenues()

    // Initialize expanded states
    if (musicListItems.length > 0) {
      setExpandedServices({ 0: true })
      setExpandedCategories({ 0: true })
    }
  }, [musicListItems.length])

  // Update the handleSubmit function to combine date and time
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError(null)

    const timezone = event.venue?.timezone || "Europe/London"

    // Prepare the event data
    const updatedEvent: Event = {
      id: event.id,
      title,
      subtitle,
      date: parseInputDate(date, timezone),
      endDate: parseInputDate(endDate, timezone),
      venueId,
      slug,
      description,
      schedule: scheduleItems.map((item) => ({
        // Combine date and time if time is provided
        date: combineDateAndTime(item.date, item.time, timezone),
        description: item.description,
      })),
      musicList: musicListItems.reduce((acc: { [key: string]: MusicItem[] }, category) => {
        acc[category.category] = category.items
        return acc
      }, {}),
    }

    try {
      console.log("Submitting update for event:", updatedEvent)

      // Call the API to update the event
      const response = await fetch(`/api/events/${event.slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Auth-Token": localStorage.getItem("adminAuthToken") || "", // Get token from localStorage
        },
        body: JSON.stringify(updatedEvent),
      })

      // Get the response text first for debugging
      const responseText = await response.text()
      console.log("Response from API:", responseText)

      // Try to parse the response as JSON
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Error parsing response:", parseError)
        throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}...`)
      }

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to update event: ${response.status} ${response.statusText}`)
      }

      // Redirect to the admin dashboard
      router.push("/admin")
    } catch (err) {
      console.error("Error updating event:", err)
      setFormError(err instanceof Error ? err.message : "Failed to update event")
      setIsLoading(false) // Make sure to set loading to false on error
    }
  }

  // Schedule Functions
  const addScheduleItem = () => {
    setScheduleItems([...scheduleItems, { date: "", time: "", description: "" }])
  }

  const removeScheduleItem = (index: number) => {
    const newScheduleItems = [...scheduleItems]
    newScheduleItems.splice(index, 1)
    setScheduleItems(newScheduleItems)
  }

  const handleScheduleChange = (index: number, field: string, value: string) => {
    const newScheduleItems = [...scheduleItems]
    newScheduleItems[index][field] = value
    setScheduleItems(newScheduleItems)
  }

  // Music Functions
  const addMusicCategory = () => {
    const newIndex = musicListItems.length
    setMusicListItems([...musicListItems, { category: "", items: [{ title: "", composer: "", type: "" }] }])
    // Expand the newly added category
    setExpandedCategories((prev) => ({ ...prev, [newIndex]: true }))
    // Set the first item of the new category as being edited
    setEditingItem({ categoryIndex: newIndex, itemIndex: 0 })
  }

  const removeMusicCategory = (categoryIndex: number) => {
    const newMusicListItems = [...musicListItems]
    newMusicListItems.splice(categoryIndex, 1)
    setMusicListItems(newMusicListItems)

    // Update expanded categories
    const newExpandedCategories = { ...expandedCategories }
    delete newExpandedCategories[categoryIndex]

    // Shift keys for categories after the removed one
    Object.keys(newExpandedCategories).forEach((key) => {
      const numKey = Number.parseInt(key)
      if (numKey > categoryIndex) {
        newExpandedCategories[numKey - 1] = newExpandedCategories[numKey]
        delete newExpandedCategories[numKey]
      }
    })

    setExpandedCategories(newExpandedCategories)

    // Clear editing state if the category being edited was removed
    if (editingItem && editingItem.categoryIndex === categoryIndex) {
      setEditingItem(null)
    } else if (editingItem && editingItem.categoryIndex > categoryIndex) {
      // Adjust the editing index if a category before it was removed
      setEditingItem({
        categoryIndex: editingItem.categoryIndex - 1,
        itemIndex: editingItem.itemIndex,
      })
    }
  }

  const handleMusicCategoryChange = (categoryIndex: number, value: string) => {
    const newMusicListItems = [...musicListItems]
    newMusicListItems[categoryIndex].category = value
    setMusicListItems(newMusicListItems)
  }

  const addMusicItem = (categoryIndex: number) => {
    const newMusicListItems = [...musicListItems]
    const newItemIndex = newMusicListItems[categoryIndex].items.length
    newMusicListItems[categoryIndex].items.push({ title: "", composer: "", type: "" })
    setMusicListItems(newMusicListItems)

    // Expand the category and set the new item as being edited
    setExpandedCategories((prev) => ({ ...prev, [categoryIndex]: true }))
    setEditingItem({ categoryIndex, itemIndex: newItemIndex })
  }

  const removeMusicItem = (categoryIndex: number, itemIndex: number) => {
    const newMusicListItems = [...musicListItems]
    newMusicListItems[categoryIndex].items.splice(itemIndex, 1)
    setMusicListItems(newMusicListItems)

    // Clear editing state if the item being edited was removed
    if (editingItem && editingItem.categoryIndex === categoryIndex && editingItem.itemIndex === itemIndex) {
      setEditingItem(null)
    } else if (editingItem && editingItem.categoryIndex === categoryIndex && editingItem.itemIndex > itemIndex) {
      // Adjust the editing index if an item before it was removed
      setEditingItem({
        categoryIndex: editingItem.categoryIndex,
        itemIndex: editingItem.itemIndex - 1,
      })
    }
  }

  const handleMusicItemChange = (categoryIndex: number, itemIndex: number, field: string, value: string) => {
    const newMusicListItems = [...musicListItems]
    newMusicListItems[categoryIndex].items[itemIndex][field] = value
    setMusicListItems(newMusicListItems)
  }

  const toggleMusicTypePopover = (categoryIndex: number, itemIndex: number, isOpen: boolean) => {
    setMusicTypeOpen((prev) => ({ ...prev, [`${categoryIndex}-${itemIndex}`]: isOpen }))
  }

  // Toggle category expanded state
  const toggleCategoryExpanded = (categoryIndex: number) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryIndex]: !prev[categoryIndex],
    }))
  }

  // Toggle service expanded state
  const toggleServiceExpanded = (categoryIndex: number) => {
    setExpandedServices((prev) => ({
      ...prev,
      [categoryIndex]: !prev[categoryIndex],
    }))
  }

  // Set an item as being edited
  const setItemEditing = (categoryIndex: number, itemIndex: number) => {
    setEditingItem({ categoryIndex, itemIndex })
    // Make sure the category is expanded
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryIndex]: true,
    }))
  }

  // Check if an item is currently being edited
  const isItemEditing = (categoryIndex: number, itemIndex: number) => {
    return editingItem?.categoryIndex === categoryIndex && editingItem?.itemIndex === itemIndex
  }

  // Render a collapsed view of a music item
  const renderCollapsedMusicItem = (item: MusicItem, categoryIndex: number, itemIndex: number) => {
    return (
      <div
        key={itemIndex}
        className="flex items-center justify-between p-3 border rounded-md bg-muted/10 cursor-pointer hover:bg-muted/20"
        onClick={() => setItemEditing(categoryIndex, itemIndex)}
      >
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{item.title || "Untitled"}</span>
            {item.composer && <span className="text-muted-foreground ml-2">by {item.composer}</span>}
            {item.type && <span className="text-xs text-muted-foreground ml-2">({item.type})</span>}
          </div>
        </div>
        <Edit className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  // Move service up in the list
  const moveServiceUp = (categoryIndex: number) => {
    if (categoryIndex === 0) return // Already at the top

    const newMusicListItems = [...musicListItems]
    // Swap with the item above
    ;[newMusicListItems[categoryIndex - 1], newMusicListItems[categoryIndex]] = [
      newMusicListItems[categoryIndex],
      newMusicListItems[categoryIndex - 1],
    ]

    setMusicListItems(newMusicListItems)

    // Set focus to the service that was moved (now at the new position)
    setFocusedServiceIndex(categoryIndex - 1)

    // Update expanded states to maintain the same expanded services
    if (expandedServices[categoryIndex] || expandedServices[categoryIndex - 1]) {
      setExpandedServices((prev) => {
        const newState = { ...prev }
        newState[categoryIndex - 1] = prev[categoryIndex]
        newState[categoryIndex] = prev[categoryIndex - 1]
        return newState
      })
    }

    // Update expanded categories to maintain the same expanded categories
    if (expandedCategories[categoryIndex] || expandedCategories[categoryIndex - 1]) {
      setExpandedCategories((prev) => {
        const newState = { ...prev }
        newState[categoryIndex - 1] = prev[categoryIndex]
        newState[categoryIndex] = prev[categoryIndex - 1]
        return newState
      })
    }

    // Update editing state if needed
    if (
      editingItem &&
      (editingItem.categoryIndex === categoryIndex || editingItem.categoryIndex === categoryIndex - 1)
    ) {
      setEditingItem({
        categoryIndex: editingItem.categoryIndex === categoryIndex ? categoryIndex - 1 : categoryIndex,
        itemIndex: editingItem.itemIndex,
      })
    }
  }

  // Move service down in the list
  const moveServiceDown = (categoryIndex: number) => {
    if (categoryIndex === musicListItems.length - 1) return // Already at the bottom

    const newMusicListItems = [...musicListItems]
    // Swap with the item below
    ;[newMusicListItems[categoryIndex], newMusicListItems[categoryIndex + 1]] = [
      newMusicListItems[categoryIndex + 1],
      newMusicListItems[categoryIndex],
    ]

    setMusicListItems(newMusicListItems)

    // Set focus to the service that was moved (now at the new position)
    setFocusedServiceIndex(categoryIndex + 1)

    // Update expanded states to maintain the same expanded services
    if (expandedServices[categoryIndex] || expandedServices[categoryIndex + 1]) {
      setExpandedServices((prev) => {
        const newState = { ...prev }
        newState[categoryIndex + 1] = prev[categoryIndex]
        newState[categoryIndex] = prev[categoryIndex + 1]
        return newState
      })
    }

    // Update expanded categories to maintain the same expanded categories
    if (expandedCategories[categoryIndex] || expandedCategories[categoryIndex + 1]) {
      setExpandedCategories((prev) => {
        const newState = { ...prev }
        newState[categoryIndex + 1] = prev[categoryIndex]
        newState[categoryIndex] = prev[categoryIndex + 1]
        return newState
      })
    }

    // Update editing state if needed
    if (
      editingItem &&
      (editingItem.categoryIndex === categoryIndex || editingItem.categoryIndex === categoryIndex + 1)
    ) {
      setEditingItem({
        categoryIndex: editingItem.categoryIndex === categoryIndex ? categoryIndex + 1 : categoryIndex,
        itemIndex: editingItem.itemIndex,
      })
    }
  }

  // Auto-expand the focused service
  useEffect(() => {
    if (focusedServiceIndex !== null) {
      // Auto-expand the focused service
      setExpandedServices((prev) => ({
        ...prev,
        [focusedServiceIndex]: true,
      }))

      // Clear the focus after a short delay
      const timer = setTimeout(() => {
        setFocusedServiceIndex(null)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [focusedServiceIndex])

  return (
    <div className="container max-w-3xl py-12">
      <div className="mb-8 px-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">Edit Event</h1>
            <p className="text-muted-foreground mt-2">Update the event details below.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => router.push(`/admin/events/${event.id}/photos`)}>
              <Camera className="h-4 w-4" />
              Photos
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Basic information about the event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{formError}</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Event Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                placeholder="Event Subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue">
              Venue <span className="text-red-500">*</span>
            </Label>
            <VenueSelector venues={venues} value={venueId} onChange={setVenueId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" placeholder="event-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Event Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Schedule Section */}
          <div className="p-6 border rounded-md bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-medium">Event Schedule</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional: Add performance times. Leave empty if not applicable.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addScheduleItem}>
                Add Schedule Item
              </Button>
            </div>

            {/* Empty state - when there are no items */}
            {scheduleItems.length === 0 && (
              <div className="bg-muted/30 rounded-md p-4 mt-4 text-center">
                <p className="text-muted-foreground">
                  No schedule items added. This section will be empty in the event.
                </p>
              </div>
            )}

            {/* Schedule items */}
            {scheduleItems.length > 0 && (
              <div className="space-y-4 mt-4">
                {scheduleItems.map((item, index) => (
                  <div key={index} className="grid gap-4 p-4 border rounded-md bg-background">
                    <div className="space-y-2">
                      <Label htmlFor={`schedule-description-${index}`}>
                        Description <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`schedule-description-${index}`}
                        value={item.description}
                        onChange={(e) => handleScheduleChange(index, "description", e.target.value)}
                        placeholder="e.g., Rehearsal, Performance, etc."
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`schedule-date-${index}`}>
                          Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`schedule-date-${index}`}
                          type="date"
                          value={item.date}
                          onChange={(e) => handleScheduleChange(index, "date", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`schedule-time-${index}`}>Time (Optional)</Label>
                        <Input
                          id={`schedule-time-${index}`}
                          type="time"
                          value={item.time}
                          onChange={(e) => handleScheduleChange(index, "time", e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        {scheduleItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeScheduleItem(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                    {(!item.date || !item.description) && (
                      <p className="text-amber-600 text-sm">
                        Both date and description are required for each schedule item to be saved.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Music List Section */}
          <div className="p-6 border rounded-md bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-medium">Music List</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add music performed at this event, organized by service type (e.g., Evensong, Mass).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addMusicCategory}>
                Add Service
              </Button>
            </div>

            {/* Empty state - when there are no items */}
            {musicListItems.length === 0 && (
              <div className="bg-muted/30 rounded-md p-4 mt-4 text-center">
                <p className="text-muted-foreground">
                  No services added yet. Add a service like "Evensong" or "Mass" to include music items.
                </p>
              </div>
            )}

            {/* Music list items */}
            {musicListItems.length > 0 && (
              <div className="space-y-6 mt-4">
                {musicListItems.map((category, categoryIndex) => (
                  <div
                    key={categoryIndex}
                    className={`p-4 border rounded-md bg-background transition-colors duration-300 ${
                      focusedServiceIndex === categoryIndex ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    {/* Service header with expand/collapse control */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-grow">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleServiceExpanded(categoryIndex)}
                          className="p-1"
                        >
                          {expandedServices[categoryIndex] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="w-full max-w-md">
                          {expandedServices[categoryIndex] ? (
                            <>
                              <Label htmlFor={`category-${categoryIndex}`} className="mb-2 block">
                                Service Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`category-${categoryIndex}`}
                                value={category.category}
                                onChange={(e) => handleMusicCategoryChange(categoryIndex, e.target.value)}
                                placeholder="e.g., Evensong, Mass, Matins"
                              />
                              {!category.category && category.items.some((item) => item.title) && (
                                <p className="text-amber-600 text-sm mt-1">
                                  Service name is required for music items to be saved.
                                </p>
                              )}
                            </>
                          ) : (
                            <div
                              className="font-medium text-lg cursor-pointer"
                              onClick={() => toggleServiceExpanded(categoryIndex)}
                            >
                              {category.category || "Unnamed Service"}
                              <span className="text-muted-foreground text-sm ml-2">
                                ({category.items.length} music item{category.items.length !== 1 ? "s" : ""})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Reordering buttons */}
                        <div className="flex flex-col gap-1 mr-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveServiceUp(categoryIndex)}
                            disabled={categoryIndex === 0}
                            className="h-6 w-6 p-0"
                            title="Move service up"
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveServiceDown(categoryIndex)}
                            disabled={categoryIndex === musicListItems.length - 1}
                            className="h-6 w-6 p-0"
                            title="Move service down"
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                        </div>

                        {expandedServices[categoryIndex] && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCategoryExpanded(categoryIndex)}
                              className="mt-6"
                            >
                              {expandedCategories[categoryIndex] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
                              onClick={() => removeMusicCategory(categoryIndex)}
                            >
                              Remove Service
                            </Button>
                          </>
                        )}
                        {!expandedServices[categoryIndex] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeMusicCategory(categoryIndex)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Collapsed service view */}
                    {!expandedServices[categoryIndex] && (
                      <div className="pl-8">
                        {category.items.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No music items added yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {category.items.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="text-sm text-muted-foreground">
                                {item.type && <span className="font-medium">{item.type}:</span>}{" "}
                                {item.title || "Untitled"}
                                {item.composer && <span> by {item.composer}</span>}
                              </div>
                            ))}
                            {category.items.length > 3 && (
                              <div className="text-sm text-muted-foreground">
                                ...and {category.items.length - 3} more item{category.items.length - 3 !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toggleServiceExpanded(categoryIndex)
                            setExpandedCategories((prev) => ({ ...prev, [categoryIndex]: true }))
                          }}
                          className="mt-2"
                        >
                          Edit Service
                        </Button>
                      </div>
                    )}

                    {/* Expanded service view - only show if service is expanded */}
                    {expandedServices[categoryIndex] && (
                      <>
                        {expandedCategories[categoryIndex] ? (
                          <div className="space-y-4">
                            {category.items.map((item, itemIndex) =>
                              isItemEditing(categoryIndex, itemIndex) ? (
                                // Expanded edit view for the item being edited
                                <div key={itemIndex} className="grid gap-4 p-3 border rounded-md bg-muted/10">
                                  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-2">
                                      <Label htmlFor={`type-${categoryIndex}-${itemIndex}`}>Type (Optional)</Label>
                                      <div className="relative">
                                        <Input
                                          id={`type-${categoryIndex}-${itemIndex}`}
                                          value={item.type}
                                          onChange={(e) =>
                                            handleMusicItemChange(categoryIndex, itemIndex, "type", e.target.value)
                                          }
                                          placeholder="Start typing or select..."
                                          onFocus={() => toggleMusicTypePopover(categoryIndex, itemIndex, true)}
                                          onBlur={() =>
                                            setTimeout(
                                              () => toggleMusicTypePopover(categoryIndex, itemIndex, false),
                                              200,
                                            )
                                          }
                                        />
                                        {musicTypeOpen[`${categoryIndex}-${itemIndex}`] && (
                                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                            {MUSIC_TYPES.filter((type) =>
                                              type.toLowerCase().includes(item.type?.toLowerCase() || ""),
                                            ).map((type) => (
                                              <div
                                                key={type}
                                                className="px-3 py-2 cursor-pointer hover:bg-muted"
                                                onMouseDown={() => {
                                                  handleMusicItemChange(categoryIndex, itemIndex, "type", type)
                                                  toggleMusicTypePopover(categoryIndex, itemIndex, false)
                                                }}
                                              >
                                                {type}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Title field - give it more space on medium screens */}
                                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                      <Label htmlFor={`title-${categoryIndex}-${itemIndex}`}>
                                        Title <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        id={`title-${categoryIndex}-${itemIndex}`}
                                        value={item.title}
                                        onChange={(e) =>
                                          handleMusicItemChange(categoryIndex, itemIndex, "title", e.target.value)
                                        }
                                        placeholder="e.g., Magnificat"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor={`composer-${categoryIndex}-${itemIndex}`}>
                                        Composer (Optional)
                                      </Label>
                                      <Input
                                        id={`composer-${categoryIndex}-${itemIndex}`}
                                        value={item.composer}
                                        onChange={(e) =>
                                          handleMusicItemChange(categoryIndex, itemIndex, "composer", e.target.value)
                                        }
                                        placeholder="e.g., Stanford"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    {!item.title && (
                                      <p className="text-amber-600 text-sm">
                                        Title is required for this item to be saved.
                                      </p>
                                    )}
                                    <div className="flex gap-2 ml-auto">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingItem(null)}
                                      >
                                        Done
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => removeMusicItem(categoryIndex, itemIndex)}
                                      >
                                        Remove Item
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // Collapsed view for items not being edited
                                renderCollapsedMusicItem(item, categoryIndex, itemIndex)
                              ),
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addMusicItem(categoryIndex)}
                              className="mt-2"
                            >
                              Add Music Item
                            </Button>
                          </div>
                        ) : (
                          // Collapsed view for the category
                          <div className="space-y-2">
                            {category.items.length === 0 ? (
                              <p className="text-muted-foreground text-sm">No music items added yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {category.items
                                  .slice(0, 2)
                                  .map((item, itemIndex) => renderCollapsedMusicItem(item, categoryIndex, itemIndex))}
                                {category.items.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-muted-foreground"
                                    onClick={() => toggleCategoryExpanded(categoryIndex)}
                                  >
                                    <span className="flex items-center gap-1">
                                      <ChevronDown className="h-4 w-4" />
                                      {category.items.length - 2} more items
                                    </span>
                                  </Button>
                                )}
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                addMusicItem(categoryIndex)
                                toggleCategoryExpanded(categoryIndex)
                              }}
                              className="mt-2 flex items-center gap-1"
                            >
                              <Plus className="h-4 w-4" /> Add Music Item
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Add a button to add another service at the bottom of the music list section */}
            {musicListItems.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="outline" onClick={() => addMusicCategory()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Service
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <div className="flex justify-end space-x-2 p-6">
          <Button variant="ghost" onClick={() => router.push("/admin")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Updating...
              </>
            ) : (
              "Update Event"
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

