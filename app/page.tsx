"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PlusCircle, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Vendor {
  id: string
  name: string
  type: "api" | "page"
  url: string
  path?: string // For API - dot notation path to status
  selector?: string // For HTML page - CSS selector
  expectedValue?: string // Expected value to match against
  status: "up" | "down" | "unknown"
  lastChecked: string
}

export default function DowntimeDetector() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [newVendor, setNewVendor] = useState<Omit<Vendor, "id" | "status" | "lastChecked">>({
    name: "",
    type: "api",
    url: "",
    path: "",
    selector: "",
    expectedValue: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Load vendors from localStorage on initial load
  useEffect(() => {
    const savedVendors = localStorage.getItem("vendors")
    if (savedVendors) {
      setVendors(JSON.parse(savedVendors))
    }
  }, [])

  // Save vendors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("vendors", JSON.stringify(vendors))
  }, [vendors])

  const addVendor = () => {
    if (!newVendor.name || !newVendor.url) {
      toast({
        title: "Missing information",
        description: "Please provide a name and URL for the vendor.",
        variant: "destructive",
      })
      return
    }

    if (newVendor.type === "api" && !newVendor.path) {
      toast({
        title: "Missing path",
        description: "Please provide a dot notation path for the API response.",
        variant: "destructive",
      })
      return
    }

    if (newVendor.type === "page" && !newVendor.selector) {
      toast({
        title: "Missing selector",
        description: "Please provide an HTML element selector.",
        variant: "destructive",
      })
      return
    }

    const vendor: Vendor = {
      id: Date.now().toString(),
      name: newVendor.name,
      type: newVendor.type,
      url: newVendor.url,
      path: newVendor.path,
      selector: newVendor.selector,
      expectedValue: newVendor.expectedValue,
      status: "unknown",
      lastChecked: new Date().toISOString(),
    }

    console.log("Adding new vendor:", vendor)
    setVendors(prevVendors => {
      const newVendors = [...prevVendors, vendor]
      console.log("Updated vendors list:", newVendors)
      return newVendors
    })
    setNewVendor({
      name: "",
      type: "api",
      url: "",
      path: "",
      selector: "",
      expectedValue: "",
    })

    // Check the status of the new vendor
    console.log("Checking vendor status:", vendor)
    checkVendorStatus(vendor).catch(error => {
      console.error("Error checking vendor status:", error)
      // Ensure vendor stays in list even if status check fails
      updateVendorStatus(vendor.id, "unknown")
    })
  }

  const removeVendor = (id: string) => {
    setVendors(vendors.filter((vendor) => vendor.id !== id))
  }

  const getValueByPath = (obj: any, path: string) => {
    return path.split(".").reduce((prev, curr) => {
      return prev && prev[curr]
    }, obj)
  }

  const checkVendorStatus = async (vendor: Vendor) => {
    try {
      if (vendor.type === "api") {
        // For API endpoints, expect JSON response
        try {
          const response = await fetch(vendor.url)
          if (!response.ok) {
            updateVendorStatus(vendor.id, "down")
            return
          }

          const data = await response.json()
          const statusValue = getValueByPath(data, vendor.path || "")

          // Check if we have an expected value to match against
          if (vendor.expectedValue) {
            const isUp = String(statusValue).toLowerCase() === vendor.expectedValue.toLowerCase()
            updateVendorStatus(vendor.id, isUp ? "up" : "down")
          } else {
            // Fallback to simple truthy check if no expected value
            updateVendorStatus(vendor.id, statusValue ? "up" : "down")
          }
        } catch (error) {
          console.error(`Error fetching API for ${vendor.name}:`, error)
          updateVendorStatus(vendor.id, "down")
        }
      } else {
        // For HTML pages, handle as text/html
        try {
          const response = await fetch(vendor.url)
          if (!response.ok) {
            updateVendorStatus(vendor.id, "down")
            toast({
              title: "HTTP Error",
              description: `Failed to fetch ${vendor.name}: HTTP ${response.status} ${response.statusText}`,
              variant: "destructive",
            })
            return
          }

          const html = await response.text()
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, "text/html")
          const element = doc.querySelector(vendor.selector || "")

          if (element) {
            const elementText = element.textContent?.trim() || ""

            // Check if we have an expected value to match against
            if (vendor.expectedValue) {
              const isUp = elementText.toLowerCase() === vendor.expectedValue.toLowerCase()
              updateVendorStatus(vendor.id, isUp ? "up" : "down")
            } else {
              // Fallback to simple existence check if no expected value
              updateVendorStatus(vendor.id, "up")
            }
          } else {
            updateVendorStatus(vendor.id, "down")
          }
        } catch (error) {
          console.error(`Error checking HTML for ${vendor.name}:`, error)
          updateVendorStatus(vendor.id, "unknown")
        }
      }
    } catch (error) {
      console.error(`Unexpected error checking status for ${vendor.name}:`, error)
      updateVendorStatus(vendor.id, "down")
    }
  }

  const updateVendorStatus = (id: string, status: "up" | "down" | "unknown") => {
    console.log(`Updating vendor ${id} status to ${status}`)
    setVendors(prevVendors => {
      const updatedVendors = prevVendors.map((vendor) =>
        vendor.id === id ? { ...vendor, status, lastChecked: new Date().toISOString() } : vendor,
      )
      console.log("Updated vendors after status change:", updatedVendors)
      return updatedVendors
    })
  }

  const refreshAllStatuses = async () => {
    setIsLoading(true)

    try {
      // Create a copy of vendors with 'unknown' status
      const refreshedVendors = vendors.map((vendor) => ({
        ...vendor,
        status: "unknown" as const,
        lastChecked: new Date().toISOString(),
      }))

      setVendors(refreshedVendors)

      // Check status for each vendor
      for (const vendor of refreshedVendors) {
        await checkVendorStatus(vendor)
      }

      toast({
        title: "Refresh complete",
        description: "All vendor statuses have been updated.",
      })
    } catch (error) {
      console.error("Error refreshing statuses:", error)
      toast({
        title: "Refresh failed",
        description: "There was an error refreshing vendor statuses.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewVendor({ ...newVendor, [name]: value })
  }

  const handleTypeChange = (value: "api" | "page") => {
    setNewVendor({ ...newVendor, type: value })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Vendor Downtime Detector</h1>

      {/* Add new vendor form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add New Vendor</CardTitle>
          <CardDescription>Monitor a vendor by API endpoint or webpage status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., AWS, Google Cloud"
                  value={newVendor.name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  name="url"
                  placeholder="https://status-api.example.com"
                  value={newVendor.url}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vendor Type</Label>
              <RadioGroup
                value={newVendor.type}
                onValueChange={(value) => handleTypeChange(value as "api" | "page")}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="api" id="api" />
                  <Label htmlFor="api">API Endpoint</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="page" id="page" />
                  <Label htmlFor="page">HTML Page</Label>
                </div>
              </RadioGroup>
            </div>

            {newVendor.type === "api" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="path">
                    JSON Path (dot notation)
                    <span className="text-sm text-muted-foreground ml-2">e.g., status.isOperational</span>
                  </Label>
                  <Input
                    id="path"
                    name="path"
                    placeholder="status.isOperational"
                    value={newVendor.path}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedValue">
                    Expected Value
                    <span className="text-sm text-muted-foreground ml-2">e.g., true, operational, 200</span>
                  </Label>
                  <Input
                    id="expectedValue"
                    name="expectedValue"
                    placeholder="true"
                    value={newVendor.expectedValue}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="selector">
                    HTML Element Selector
                    <span className="text-sm text-muted-foreground ml-2">e.g., #status-indicator, .status-text</span>
                  </Label>
                  <Input
                    id="selector"
                    name="selector"
                    placeholder="#status-indicator"
                    value={newVendor.selector}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedValue">
                    Expected Text
                    <span className="text-sm text-muted-foreground ml-2">e.g., Operational, Running, OK</span>
                  </Label>
                  <Input
                    id="expectedValue"
                    name="expectedValue"
                    placeholder="Operational"
                    value={newVendor.expectedValue}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={addVendor} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </CardFooter>
      </Card>

      {/* Vendor status dashboard */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Vendor Status Dashboard</h2>
        <Button onClick={refreshAllStatuses} disabled={isLoading || vendors.length === 0} variant="outline">
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Refresh All
        </Button>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">No vendors added yet. Add your first vendor above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="overflow-hidden">
              <div
                className={cn(
                  "h-2",
                  vendor.status === "up" ? "bg-green-500" : vendor.status === "down" ? "bg-red-500" : "bg-yellow-500",
                )}
              />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{vendor.name}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => removeVendor(vendor.id)} className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="truncate">{vendor.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full",
                      vendor.status === "up"
                        ? "bg-green-500"
                        : vendor.status === "down"
                          ? "bg-red-500"
                          : "bg-yellow-500",
                    )}
                  />
                  <span className="font-medium">
                    {vendor.status === "up" ? "Operational" : vendor.status === "down" ? "Down" : "Unknown"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Type: {vendor.type === "api" ? "API Endpoint" : "HTML Page"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {vendor.type === "api" ? `Path: ${vendor.path}` : `Selector: ${vendor.selector}`}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Last checked: {new Date(vendor.lastChecked).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

