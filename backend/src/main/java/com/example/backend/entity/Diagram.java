package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "diagrams")
public class Diagram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "is_public")
    private Boolean isPublic = false;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String preview;

    @Column(length = 100)
    private String template;


    @OneToMany(mappedBy = "diagram", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiagramBlock> blocks = new ArrayList<>();

    // Participants are managed solely through the DiagramParticipant entity
    // (which carries the role). A separate @ManyToMany to the same
    // diagram_participants table caused a duplicate INSERT of (diagram_id,
    // user_id) and a unique-constraint violation when adding a participant.
    @OneToMany(mappedBy = "diagram", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiagramParticipant> participantRoles = new ArrayList<>();

    public Diagram() {}

    public Diagram(String name, User owner) {
        this.name = name;
        this.owner = owner;
    }


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public Boolean getIsPublic() { return isPublic; }
    public void setIsPublic(Boolean isPublic) { this.isPublic = isPublic; }
    public List<DiagramBlock> getBlocks() { return blocks; }
    public void setBlocks(List<DiagramBlock> blocks) { this.blocks = blocks; }
    public List<DiagramParticipant> getParticipantRoles() { return participantRoles; }
    public void setParticipantRoles(List<DiagramParticipant> participantRoles) { this.participantRoles = participantRoles; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getPreview() { return preview; }
    public void setPreview(String preview) { this.preview = preview; }
    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }


    public void addBlock(DiagramBlock block) {
        blocks.add(block);
        block.setDiagram(this);
    }

    public void removeBlock(DiagramBlock block) {
        blocks.remove(block);
        block.setDiagram(null);
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}