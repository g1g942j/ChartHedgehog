package com.example.backend.dto;

public class DiagramSummaryDto {
    private Long id;
    private String name;
    private String description;
    private String createdAt;
    private String updatedAt;
    private String ownerUsername;
    private String role;
    private String preview;

    public DiagramSummaryDto() {}

    public DiagramSummaryDto(Long id, String name, String description, String createdAt,
                              String updatedAt, String ownerUsername, String role, String preview) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.ownerUsername = ownerUsername;
        this.role = role;
        this.preview = preview;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
    public String getOwnerUsername() { return ownerUsername; }
    public void setOwnerUsername(String ownerUsername) { this.ownerUsername = ownerUsername; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getPreview() { return preview; }
    public void setPreview(String preview) { this.preview = preview; }
}
