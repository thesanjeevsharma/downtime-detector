"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PlusCircle, RefreshCw, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface Service {
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
  const [services, setServices] = useState<Service[]>([])
  const [newService, setNewService] = useState<Omit<Service, "id" | "status" | "lastChecked">>({
    name: "",
    type: "api",
    url: "",
    path: "",
    selector: "",
    expectedValue: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(true)
  const { toast } = useToast()

  // Load services from localStorage on initial load
  useEffect(() => {
    const savedServices = localStorage.getItem("services")
    if (savedServices) {
      const parsedServices = JSON.parse(savedServices)
      setServices(parsedServices)
      setIsFormOpen(parsedServices.length === 0)
    }
  }, [])

  // Save services to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("services", JSON.stringify(services))
  }, [services])

  const addService = () => {
    if (!newService.name || !newService.url) {
      toast({
        title: "Missing information",
        description: "Please provide a name and URL for the service.",
        variant: "destructive",
      })
      return
    }

    if (newService.type === "api" && !newService.path) {
      toast({
        title: "Missing path",
        description: "Please provide a dot notation path for the API response.",
        variant: "destructive",
      })
      return
    }

    if (newService.type === "page" && !newService.selector) {
      toast({
        title: "Missing selector",
        description: "Please provide an HTML element selector.",
        variant: "destructive",
      })
      return
    }

    const service: Service = {
      id: Date.now().toString(),
      name: newService.name,
      type: newService.type,
      url: newService.url,
      path: newService.path,
      selector: newService.selector,
      expectedValue: newService.expectedValue,
      status: "unknown",
      lastChecked: new Date().toISOString(),
    }

    console.log("Adding new service:", service)
    setServices(prevServices => {
      const newServices = [...prevServices, service]
      console.log("Updated services list:", newServices)
      return newServices
    })
    setNewService({
      name: "",
      type: "api",
      url: "",
      path: "",
      selector: "",
      expectedValue: "",
    })

    // Check the status of the new service
    console.log("Checking service status:", service)
    checkServiceStatus(service).catch(error => {
      console.error("Error checking service status:", error)
      // Ensure service stays in list even if status check fails
      updateServiceStatus(service.id, "unknown")
    })
  }

  const removeService = (id: string) => {
    setServices(services.filter((service) => service.id !== id))
  }

  const checkServiceStatus = async (service: Service) => {
    try {
      const response = await fetch('/api/check-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: service.type,
          url: service.url,
          path: service.path,
          selector: service.selector,
          expectedValue: service.expectedValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to check status')
      }

      const data = await response.json()
      updateServiceStatus(service.id, data.status)

      if (data.error) {
        toast({
          title: "Error",
          description: `Error checking ${service.name}: ${data.error}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Error checking status for ${service.name}:`, error)
      updateServiceStatus(service.id, "unknown")
      toast({
        title: "Error",
        description: `Failed to check ${service.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    }
  }

  const updateServiceStatus = (id: string, status: "up" | "down" | "unknown") => {
    console.log(`Updating service ${id} status to ${status}`)
    setServices(prevServices => {
      const updatedServices = prevServices.map((service) =>
        service.id === id ? { ...service, status, lastChecked: new Date().toISOString() } : service,
      )
      console.log("Updated services after status change:", updatedServices)
      return updatedServices
    })
  }

  const refreshAllStatuses = async () => {
    setIsLoading(true)

    try {
      // Create a copy of services with 'unknown' status
      const refreshedServices = services.map((service) => ({
        ...service,
        status: "unknown" as const,
        lastChecked: new Date().toISOString(),
      }))

      setServices(refreshedServices)

      // Check status for each service
      for (const service of refreshedServices) {
        await checkServiceStatus(service)
      }

      toast({
        title: "Refresh complete",
        description: "All service statuses have been updated.",
      })
    } catch (error) {
      console.error("Error refreshing statuses:", error)
      toast({
        title: "Refresh failed",
        description: "There was an error refreshing service statuses.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewService({ ...newService, [name]: value })
  }

  const handleTypeChange = (value: "api" | "page") => {
    setNewService({ ...newService, type: value })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">🔥 Service Downtime Detector</h1>

      {/* Add new service form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Add New Service</h2>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isFormOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Service Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., AWS, Google Cloud"
                      value={newService.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      name="url"
                      placeholder="https://status-api.example.com"
                      value={newService.url}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <RadioGroup
                    value={newService.type}
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

                {newService.type === "api" ? (
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
                        value={newService.path}
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
                        value={newService.expectedValue}
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
                        value={newService.selector}
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
                        value={newService.expectedValue}
                        onChange={handleInputChange}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={addService} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </CardFooter>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Service status dashboard */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Service Status Dashboard</h2>
        <Button onClick={refreshAllStatuses} disabled={isLoading || services.length === 0} variant="outline">
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Refresh All
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">No services added yet. Add your first service above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} className="overflow-hidden">
              <div
                className={cn(
                  "h-2",
                  service.status === "up" ? "bg-green-500" : service.status === "down" ? "bg-red-500" : "bg-yellow-500",
                )}
              />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{service.name}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => removeService(service.id)} className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="truncate">{service.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full",
                      service.status === "up"
                        ? "bg-green-500"
                        : service.status === "down"
                          ? "bg-red-500"
                          : "bg-yellow-500",
                    )}
                  />
                  <span className="font-medium">
                    {service.status === "up" ? "Operational" : service.status === "down" ? "Down" : "Unknown"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Type: {service.type === "api" ? "API Endpoint" : "HTML Page"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {service.type === "api" ? `Path: ${service.path}` : `Selector: ${service.selector}`}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Last checked: {new Date(service.lastChecked).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

